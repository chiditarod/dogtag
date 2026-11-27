require "spec_helper"
require "stripe_mock"

describe "API v1 staff refund batches", type: :request do
  let(:stripe_helper) { StripeMock.create_test_helper }
  let(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let(:refunder) { FactoryBot.create(:refunder_user) }

  before { StripeMock.start }
  after { StripeMock.stop }

  def paid(amount: 5000)
    charge = Stripe::Charge.create(amount: amount, currency: "usd", source: stripe_helper.generate_card_token)
    team = FactoryBot.create(:team, race: requirement.race)
    requirement.complete(team.id, team.user, "charge_id" => charge.id, "customer_id" => "cus_1", "amount" => amount)
  end

  def create_batch(ids, confirmation: "REFUND #{ids.size}", total: 5000 * ids.size)
    post "/api/v1/staff/refund_batches", params: { completed_requirement_ids: ids, confirmation: confirmation, expected_total_cents: total }, as: :json
  end

  def no_batch_created
    expect { yield }.not_to change { [RefundBatch.count, RefundBatchItem.count] }
    expect(Workers::RefundBatch.jobs).to be_empty
  end

  describe "authorization" do
    it "is 401 when logged out and 403 for a racer" do
      post "/api/v1/staff/refund_batches", params: {}, as: :json
      expect(response).to have_http_status(:unauthorized)

      api_login(FactoryBot.create(:user))
      no_batch_created do
        create_batch([paid.id])
        expect(response).to have_http_status(:forbidden)
      end
      get "/api/v1/staff/refund_batches/1"
      expect(response).to have_http_status(:forbidden)
    end
  end

  context "as a refunder" do
    before { api_login(refunder) }

    describe "POST /staff/refund_batches" do
      it "403 for reopen: refunders may refund but not reopen" do
        cr = paid

        no_batch_created do
          post "/api/v1/staff/refund_batches", params: { completed_requirement_ids: [cr.id], confirmation: "REFUND 1", expected_total_cents: 5000, reopen: true }, as: :json
        end
        expect(response).to have_http_status(:forbidden)
      end

      it "refunds only when reopen is absent" do
        create_batch([paid.id])

        expect(RefundBatch.last.reopen).to be_blank
        expect(json["batch"]).to include("reopen" => false)
      end

      it "201 queues the batch and enqueues the job" do
        crs = [paid, paid]

        create_batch(crs.map(&:id))

        expect(response).to have_http_status(:created)
        batch = RefundBatch.last
        expect(batch.user).to eq(refunder)
        expect(Workers::RefundBatch.jobs.size).to eq(1)
        expect(json["batch"]).to include("id" => batch.id, "finished_at" => nil, "retry_of_id" => nil)
        expect(json["batch"]["items"].map { |item| item["completed_requirement_id"] }).to match_array(crs.map(&:id))
        expect(json["batch"]["items"].first).to include(
          "status" => "queued", "amount_cents" => 5000, "payment_type" => requirement.name, "team_name" => be_a(String)
        )
      end

      it "422 batch_too_large over the cap" do
        ids = Array.new(6) { paid.id }

        no_batch_created do
          create_batch(ids)
          expect(response).to have_http_status(:unprocessable_entity)
          expect(json).to include("code" => "batch_too_large")
        end
      end

      it "422 confirmation_mismatch" do
        no_batch_created do
          create_batch([paid.id], confirmation: "REFUND 2")
          expect(response).to have_http_status(:unprocessable_entity)
          expect(json).to include("code" => "confirmation_mismatch")
        end
      end

      it "422 selection_changed when the total differs" do
        no_batch_created do
          create_batch([paid.id], total: 1)
          expect(response).to have_http_status(:unprocessable_entity)
          expect(json).to include("code" => "selection_changed")
        end
      end

      it "accepts the total as 5000.0 and 422 invalid_total for non-numeric" do
        cr = paid
        create_batch([cr.id], total: 5000.0)
        expect(response).to have_http_status(:created)

        no_batch_created_after = RefundBatch.count
        create_batch([paid.id], total: "lots")
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json).to include("code" => "invalid_total")
        expect(RefundBatch.count).to eq(no_batch_created_after)
      end

      it "422 not_refundable with errors keyed by id" do
        refunded = paid
        refunded.update!(refunded_at: 1.day.ago)
        good = paid

        no_batch_created do
          create_batch([refunded.id, good.id], total: 10_000)
          expect(response).to have_http_status(:unprocessable_entity)
          expect(json).to include("code" => "not_refundable", "errors" => { refunded.id.to_s => ["already refunded"] })
        end
      end

      it "the second of two identical requests queues nothing and Stripe is called once" do
        cr = paid
        create_batch([cr.id])
        expect(response).to have_http_status(:created)
        Sidekiq::Testing.inline! { Workers::RefundBatch.drain }
        expect(Stripe::Refund).not_to receive(:create)

        create_batch([cr.id])

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json).to include("code" => "not_refundable", "errors" => { cr.id.to_s => ["already refunded"] })
        expect(RefundBatch.count).to eq(1)
      end

      it "400 for an empty selection" do
        no_batch_created do
          create_batch([], confirmation: "REFUND 0", total: 0)
          expect(response).to have_http_status(:bad_request)
        end
      end
    end

    describe "a batch with one failure, then a retry" do
      it "refunds each payment exactly once and emails each team once" do
        crs = [paid, paid, paid]
        flaky = crs[1]
        failed_once = false
        refunds = Hash.new(0)
        allow(Stripe::Refund).to receive(:create).and_wrap_original do |original, params, opts|
          if params[:charge] == flaky.charge_id && !failed_once
            failed_once = true
            raise Stripe::APIConnectionError.new("Connection reset")
          end
          refunds[params[:charge]] += 1
          original.call(params, opts)
        end

        Sidekiq::Testing.inline! do
          create_batch(crs.map(&:id), total: 15_000)
          expect(response).to have_http_status(:created)
          batch_id = json["batch"]["id"]

          get "/api/v1/staff/refund_batches/#{batch_id}"
          items = json["batch"]["items"]
          expect(json["batch"]["finished_at"]).to be_present
          expect(items.map { |item| item["status"] }).to eq(%w[refunded failed refunded])
          expect(items[1]).to include("error_code" => "stripe_error", "message" => be_present)
          expect(crs.map { |cr| cr.reload.refunded? }).to eq([true, false, true])
          expect(SentEmail.where(kind: "refund").count).to eq(2)

          post "/api/v1/staff/refund_batches/#{batch_id}/retry", as: :json
          expect(response).to have_http_status(:created)
          expect(json["batch"]).to include("retry_of_id" => batch_id)
          expect(json["batch"]["items"].map { |item| [item["completed_requirement_id"], item["status"]] }).to eq([[flaky.id, "refunded"]])
        end

        expect(crs.map { |cr| cr.reload.refunded? }).to eq([true, true, true])
        expect(crs.map(&:charge_id).map { |id| refunds[id] }).to eq([1, 1, 1])
        expect(SentEmail.where(kind: "refund").count).to eq(3)
        expect(SentEmail.where(kind: "refund").pluck(:team_id).uniq.size).to eq(3)
        expect(ActionMailer::Base.deliveries.size).to eq(3)
      end
    end

    describe "POST /staff/refund_batches/:id/retry" do
      it "returns a new batch with retry_of_id" do
        batch = FactoryBot.create(:refund_batch, user: refunder)
        failed = FactoryBot.create(:refund_batch_item, refund_batch: batch, status: "failed",
          completed_requirement: paid)

        post "/api/v1/staff/refund_batches/#{batch.id}/retry", as: :json

        expect(response).to have_http_status(:created)
        expect(json["batch"]["retry_of_id"]).to eq(batch.id)
        expect(json["batch"]["items"].map { |item| item["completed_requirement_id"] }).to eq([failed.completed_requirement_id])
        expect(Workers::RefundBatch.jobs.size).to eq(1)
      end

      it "422 nothing_to_retry" do
        batch = FactoryBot.create(:refund_batch, user: refunder)

        post "/api/v1/staff/refund_batches/#{batch.id}/retry", as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json).to include("code" => "nothing_to_retry")
      end

      it "404 for an unknown batch" do
        post "/api/v1/staff/refund_batches/0/retry", as: :json
        expect(response).to have_http_status(:not_found)
      end
    end

    it "403 retrying a reopen batch, which would reopen too" do
      batch = FactoryBot.create(:refund_batch, user: FactoryBot.create(:operator_user), reopen: true)
      FactoryBot.create(:refund_batch_item, refund_batch: batch, status: "failed", completed_requirement: paid)

      no_batch_created do
        post "/api/v1/staff/refund_batches/#{batch.id}/retry", as: :json
      end
      expect(response).to have_http_status(:forbidden)
    end

    describe "GET /staff/refund_batches/:id" do
      it "shows any staff member's batch with its items" do
        other = FactoryBot.create(:operator_user)
        batch = FactoryBot.create(:refund_batch, user: other)
        item = FactoryBot.create(:refund_batch_item, refund_batch: batch, status: "failed", error_code: "stripe_error", message: "No such charge")

        get "/api/v1/staff/refund_batches/#{batch.id}"

        expect(response).to have_http_status(:ok)
        expect(json["batch"]["id"]).to eq(batch.id)
        expect(json["batch"]["items"].first).to include("id" => item.id, "status" => "failed", "error_code" => "stripe_error", "message" => "No such charge")
      end

      it "reports items stalled after 10 minutes" do
        start = Time.utc(2026, 11, 24, 12, 0, 0)
        batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch, user: refunder) }
        FactoryBot.create(:refund_batch_item, refund_batch: batch)

        Timecop.freeze(start + 9.minutes) { get "/api/v1/staff/refund_batches/#{batch.id}" }
        expect(json["batch"]["items"].first["status"]).to eq("queued")

        Timecop.freeze(start + 11.minutes) { get "/api/v1/staff/refund_batches/#{batch.id}" }
        expect(json["batch"]["items"].first["status"]).to eq("stalled")
      end

      it "does not write anything on GET: a stalled item stays queued in the database" do
        start = Time.utc(2026, 11, 24, 12, 0, 0)
        batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch, user: refunder) }
        item = FactoryBot.create(:refund_batch_item, refund_batch: batch)
        before = item.reload.attributes

        Timecop.freeze(start + 11.minutes) { get "/api/v1/staff/refund_batches/#{batch.id}" }

        expect(json["batch"]["items"].first["status"]).to eq("stalled")
        expect(item.reload.attributes).to eq(before)
        expect(item.finished_at).to be_nil
      end

      it "404 for an unknown batch" do
        get "/api/v1/staff/refund_batches/0"
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  context "as an operator" do
    let(:operator) { FactoryBot.create(:operator_user) }

    before { api_login(operator) }

    it "records reopen on the batch and reports it, with each item's reopened flag" do
      cr = paid

      post "/api/v1/staff/refund_batches", params: { completed_requirement_ids: [cr.id], confirmation: "REFUND 1", expected_total_cents: 5000, reopen: true }, as: :json

      expect(response).to have_http_status(:created)
      expect(RefundBatch.last.reopen).to be(true)
      expect(json["batch"]).to include("reopen" => true)
      expect(json["batch"]["items"].first).to include("reopened" => false)
    end

    it "retries a reopen batch as a reopen batch" do
      batch = FactoryBot.create(:refund_batch, user: operator, reopen: true)
      FactoryBot.create(:refund_batch_item, refund_batch: batch, status: "failed", completed_requirement: paid)

      post "/api/v1/staff/refund_batches/#{batch.id}/retry", as: :json

      expect(response).to have_http_status(:created)
      expect(RefundBatch.last).to have_attributes(retry_of_id: batch.id, reopen: true)
    end
  end
end
