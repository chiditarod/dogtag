require "spec_helper"

describe Workers::ClassyCacheOrgMemberCacher do
  let(:worker) { described_class.new }
  let(:auth_body) { { "access_token" => "abc", "token_type" => "bearer", "expires_in" => 3600 }.to_json }

  around do |example|
    saved = ENV.to_h.slice("CLASSY_CLIENT_ID", "CLASSY_CLIENT_SECRET", "CLASSY_ORGS")
    ENV["CLASSY_CLIENT_ID"] = "some_id"
    ENV["CLASSY_CLIENT_SECRET"] = "some_secret"
    example.run
  ensure
    %w[CLASSY_CLIENT_ID CLASSY_CLIENT_SECRET CLASSY_ORGS].each { |k| ENV.delete(k) }
    ENV.update(saved)
  end

  before { stub_request(:post, ClassyClient::AUTH_ENDPOINT).to_return(status: 200, body: auth_body) }

  def supporter(member_id, email, updated_at)
    { "member_id" => member_id, "email_address" => email, "updated_at" => updated_at }
  end

  def stub_supporters(org_id, page:, last_page:, data:)
    body = { "current_page" => page, "last_page" => last_page, "data" => data }.to_json
    stub_request(:get, "#{ClassyClient::API_HOST}/#{ClassyClient::API_VERSION}/organizations/#{org_id}/supporters?page=#{page}")
      .to_return(status: 200, body: body)
  end

  describe "#perform" do
    context "with multiple orgs and multiple pages" do
      before do
        ENV["CLASSY_ORGS"] = "1,2"
        stub_supporters(1, page: 1, last_page: 2, data: [
          supporter(10, "a@example.com", "2024-01-01 10:00:00"),
          supporter(11, "b@example.com", "2024-01-02 10:00:00")
        ])
        stub_supporters(1, page: 2, last_page: 2, data: [supporter(12, "c@example.com", "2024-01-03 10:00:00")])
        stub_supporters(2, page: 1, last_page: 1, data: [supporter(20, "d@example.com", "2024-02-01 10:00:00")])
      end

      it "stores a row for every supporter, tagged with its org" do
        expect { worker.perform }.to change(ClassyCacheOrgMember, :count).by(4)

        expect(ClassyCacheOrgMember.where(classy_org_id: 1).pluck(:email)).to match_array(%w[a@example.com b@example.com c@example.com])
        expect(ClassyCacheOrgMember.find_by(email: "d@example.com")).to have_attributes(classy_org_id: 2, classy_member_id: 20)
      end

      it "is idempotent when run again with the same data" do
        worker.perform
        expect { worker.perform }.not_to change(ClassyCacheOrgMember, :count)
      end
    end

    context "when a member's record is updated in Classy" do
      before do
        ENV["CLASSY_ORGS"] = "1"
        stub_supporters(1, page: 1, last_page: 1, data: [supporter(10, "a@example.com", "2024-01-01 10:00:00")])
        worker.perform
        stub_supporters(1, page: 1, last_page: 1, data: [supporter(99, "a@example.com", "2024-06-01 10:00:00")])
      end

      # Characterizes current behavior: the upsert's conflict target includes
      # classy_updated_at, so an updated record adds a row instead of replacing
      # the old one. ClassyUser reads the newest row, so lookups stay correct.
      it "keeps both versions, and the newest classy_updated_at wins on lookup" do
        expect { worker.perform }.to change(ClassyCacheOrgMember, :count).by(1)

        newest = ClassyCacheOrgMember.where(email: "a@example.com").order(classy_updated_at: :desc).first
        expect(newest).to have_attributes(classy_member_id: 99, classy_updated_at: Time.utc(2024, 6, 1, 10))
      end
    end

    context "with incomplete supporter records" do
      before do
        ENV["CLASSY_ORGS"] = "1"
        stub_supporters(1, page: 1, last_page: 1, data: [
          supporter(nil, "nomember@example.com", "2024-01-01 10:00:00"),
          supporter(11, nil, "2024-01-01 10:00:00"),
          supporter(12, "noupdated@example.com", nil),
          supporter(13, "ok@example.com", "2024-01-01 10:00:00")
        ])
      end

      it "skips them" do
        allow(Rails.logger).to receive(:debug)
        allow(Rails.logger).to receive(:info)

        worker.perform

        expect(ClassyCacheOrgMember.pluck(:email)).to eq(["ok@example.com"])
        expect(Rails.logger).to have_received(:debug)
          .with(hash_including(message: "skipping record; missing data")).exactly(3).times
      end
    end

    context "when CLASSY_ORGS is blank" do
      before { ENV["CLASSY_ORGS"] = "" }

      it "is a no-op" do
        expect { worker.perform }.not_to change(ClassyCacheOrgMember, :count)
        expect(WebMock).not_to have_requested(:get, /api\.classy\.org/)
      end
    end

    context "when CLASSY_ORGS is unset" do
      before { ENV.delete("CLASSY_ORGS") }

      it "is a no-op" do
        expect { worker.perform }.not_to change(ClassyCacheOrgMember, :count)
        expect(WebMock).not_to have_requested(:get, /api\.classy\.org/)
      end
    end

    context "when Classy responds with a 500 after an earlier org succeeded" do
      before do
        ENV["CLASSY_ORGS"] = "1,2"
        stub_supporters(1, page: 1, last_page: 1, data: [supporter(10, "a@example.com", "2024-01-01 10:00:00")])
        stub_request(:get, "#{ClassyClient::API_HOST}/#{ClassyClient::API_VERSION}/organizations/2/supporters?page=1")
          .to_return(status: 500, body: "boom")
      end

      # 500 is not in RETRIABLE_STATUS_CODES, so ClassyClient raises TransientError
      # immediately and Workers::Common#perform logs the error and re-raises it.
      # Records are imported once after every org is fetched, so org 1's
      # members are not stored either.
      it "logs the error, re-raises, and stores nothing" do
        expect(Rails.logger).to receive(:error).with(hash_including(message: "error", error: hash_including(klass: TransientError)))
        allow(Rails.logger).to receive(:info)
        allow(Rails.logger).to receive(:debug)

        expect { worker.perform }.to raise_error(TransientError, /500/)
        expect(ClassyCacheOrgMember.count).to eq(0)
        expect(WebMock).to have_requested(:get, %r{organizations/2/supporters\?page=1}).once
      end
    end
  end
end
