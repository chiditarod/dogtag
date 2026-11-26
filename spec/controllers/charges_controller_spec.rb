# Copyright (C) 2014 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
require 'spec_helper'
require 'stripe_mock'

describe ChargesController do

  let(:stripe_helper) { StripeMock.create_test_helper }

  context '[logged out]' do
    shared_examples 'redirects to login' do
      it 'redirects to login' do
        endpoint.call
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    describe '#create' do
      let(:endpoint) { lambda { post :create }}
      include_examples 'redirects to login'
    end
    describe '#refund' do
      let(:endpoint) { lambda { post :refund, params: { charge_id: 1 } }}
      include_examples 'redirects to login'
    end
  end

  context '[logged in]' do

    shared_examples "redirects to prior url" do
      it 'redirects to the prior url' do
        expect(response).to redirect_to('/prior_url/')
      end
    end

    let(:valid_user) { FactoryBot.create :user }
    let(:the_user)   { valid_user }
    before do
      activate_authlogic
      login_user! the_user
    end

    describe '#create' do

      context 'when session[:prior_url] is not set' do
        let(:error_json) {{ errors: "The calling controller should set session[:prior_url] so this method knows where to return to. e.g. session[:prior_url] = request.original_url"}.to_json}
        it "renders 400 with json message" do
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi', metadata: {bat: :baz} }
          expect(response.status).to eq(400)
          expect(response.body).to eq(error_json)
        end
      end

      context 'when stripe cannot find or create a customer' do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        before do
          expect(Customer).to receive(:get).and_return nil
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it 'renders flash error' do
          expect(flash[:error]).to eq(I18n.t 'charges.unable_to_get_customer')
        end

        include_examples "redirects to prior url"
      end

      let(:valid_params) {{
        amount: 5000,
        stripeToken: 'foo',
        stripeEmail: 'bar',
        description: 'hi',
        metadata: {
          bat: 'baz'
        }
      }}

      ChargesController::STRIPE_PARAMS.each do |param|
        context "when params['#{param}'] is missing from request" do
          before do
            post :create, params: valid_params.except(param)
          end

          it "render a json error and returns bad request" do
            expect(response.status).to eq(400)
            json = JSON.parse(response.body)
            expect(json['errors']).to eq("param is missing or the value is empty or invalid: #{param}")
          end
        end
      end

      context "when Charge is successful" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        let(:customer) do
          Stripe::Customer.create({
            card: stripe_helper.generate_card_token,
            email: team.user.email,
            metadata: {
              user_id: team.user.id
            }
          })
        end

        let(:charge) do
          Stripe::Charge.create({
            customer:    customer.id,
            amount:      7000,
            currency:    'usd',
            description: 'Registration Fee for Arizona Quints | Chiditarod X',
            metadata: {
              race_name: team.race.name,
              team_name: team.name,
              requirement_id: requirement.id,
              team_id: team.id
            }
          })
        end

        let(:amount) { '5000' }

        before do
          StripeMock.start
          expect(Customer).to receive(:get).and_return(customer)
          expect(Stripe::Charge).to receive(:create).with(hash_including(amount: 5000)).and_return(charge)
          session[:prior_url] = '/prior_url/'

          expect(CompletedRequirement.count).to eq(0)

          post :create, params: { amount: amount, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: {
              team_id: team.id,
              requirement_id: requirement.id
            }.to_json }
        end
        after { StripeMock.stop }

        it 'stores the charge details on the completed_requirement' do
          cr_metadata = {
            'customer_id' => customer.id,
            'charge_id' => charge.id,
            'amount' => 5000
          }
          expect(CompletedRequirement.last.metadata).to eq(cr_metadata)
        end

        it 'creates and saves the completed_requirement' do
          # this is brittle, but we need something.
          expect(CompletedRequirement.count).to eq(1)
        end

        it 'renders flash notice' do
          expect(flash[:notice]).to eq('Your card has been charged successfully.')
        end

        include_examples "redirects to prior url"
      end

      context "when the requirement has no active price" do
        let(:requirement) { FactoryBot.create :payment_requirement }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        before do
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes an error and does not charge" do
          expect(flash[:error]).to eq(I18n.t("charges.no_active_price"))
          expect(CompletedRequirement.count).to eq(0)
        end

        include_examples "redirects to prior url"
      end

      context "when registration is closed" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        before do
          requirement.race.update_column(:registration_close, 1.week.ago)
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes the closed message and does not charge" do
          expect(flash[:error]).to eq(I18n.t("api.errors.registration_closed"))
          expect(CompletedRequirement.count).to eq(0)
        end

        include_examples "redirects to prior url"
      end

      context "when the posted amount no longer matches the active price" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        before do
          expect(Customer).not_to receive(:get)
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 4000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes the new price and does not charge" do
          expect(flash[:error]).to eq(I18n.t("charges.price_changed", amount: "$50.00"))
          expect(CompletedRequirement.count).to eq(0)
        end

        include_examples "redirects to prior url"
      end

      context "when the race is full and the team is waitlisted" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        before do
          requirement.race.update_column(:max_teams, 0)
          expect(Customer).not_to receive(:get)
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes the waitlist message and does not charge" do
          expect(flash[:error]).to eq(I18n.t("charges.race_full"))
          expect(CompletedRequirement.count).to eq(0)
        end

        include_examples "redirects to prior url"
      end

      context "when the team still needs racers" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, user: the_user, race: requirement.race }

        before do
          expect(Customer).not_to receive(:get)
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes that payment is locked until the roster is full and does not charge" do
          expect(flash[:error]).to eq(I18n.t("charges.roster_incomplete"))
          expect(CompletedRequirement.count).to eq(0)
        end

        include_examples "redirects to prior url"
      end

      context "when the team belongs to another user" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, race: requirement.race }

        it "raises AccessDenied and does not charge" do
          session[:prior_url] = '/prior_url/'
          expect(Customer).not_to receive(:get)
          expect(Stripe::Charge).not_to receive(:create)
          expect {
            post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                    metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
          }.to raise_error(CanCan::AccessDenied)
          expect(CompletedRequirement.count).to eq(0)
        end
      end

      context "when the user may edit the team as an operator" do
        let(:the_user) { FactoryBot.create :operator_user }
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, race: requirement.race }

        before { StripeMock.start }
        after { StripeMock.stop }

        it "charges" do
          session[:prior_url] = '/prior_url/'
          customer = Stripe::Customer.create(card: stripe_helper.generate_card_token, email: 'a@b.co')
          expect(Customer).to receive(:get).and_return(customer)
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
          expect(CompletedRequirement.count).to eq(1)
        end
      end

      context "when the requirement belongs to another race" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user }

        before do
          expect(Customer).not_to receive(:get)
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes an error and does not charge" do
          expect(flash[:error]).to eq(I18n.t("charges.wrong_race"))
          expect(CompletedRequirement.count).to eq(0)
        end

        include_examples "redirects to prior url"
      end

      context "when the requirement is already paid for the team" do
        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }

        before do
          requirement.complete(team.id, the_user, { 'charge_id' => 'ch_1', 'amount' => 5000 })
          expect(Customer).not_to receive(:get)
          expect(Stripe::Charge).not_to receive(:create)
          session[:prior_url] = '/prior_url/'
          post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi',
                                  metadata: { team_id: team.id, requirement_id: requirement.id }.to_json }
        end

        it "flashes an error and does not charge again" do
          expect(flash[:error]).to eq(I18n.t("charges.already_paid"))
          expect(CompletedRequirement.count).to eq(1)
        end

        include_examples "redirects to prior url"
      end

      shared_examples 'sets_flash_error' do
        it 'renders appropriate flash error' do
          expect(flash[:error]).to match(expected_flash_error)
        end
      end

      context "Stripe Errors" do
        before do
          StripeMock.start
          expect(Customer).to receive(:get).and_return(customer)
          expect(StripeHelper).to receive(:log_and_return_error)
          session[:prior_url] = '/prior_url/'
        end
        after { StripeMock.stop }

        let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
        let(:team) { FactoryBot.create :team, :with_enough_people, user: the_user, race: requirement.race }
        let(:stripe_metadata) { { team_id: team.id, requirement_id: requirement.id }.to_json }

        let(:customer) do
          Stripe::Customer.create({
            card: stripe_helper.generate_card_token,
            email: 'musher@chiditarod.com',
            metadata: {
              user_id: 1
            }
          })
        end

        context "Stripe returns invalid request" do
          before do
            expect(Stripe::Charge).to receive(:create).and_raise(Stripe::InvalidRequestError.new(I18n.t("foo"), :foo))
            post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: stripe_metadata }
          end

          let(:expected_flash_error) { /Invalid parameters supplied to Stripe API/ }
          include_examples "redirects to prior url"
        end

        context "Stripe returns API connection error" do
          before do
            expect(Stripe::Charge).to receive(:create).and_raise(Stripe::APIConnectionError.new("foo", :foo))
            post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: stripe_metadata }
          end

          let(:expected_flash_error) { /There is an issue connecting to the Stripe API/ }
          include_examples "redirects to prior url"
        end

        context "Stripe returns generic StripeError" do
          before do
            expect(Stripe::Charge).to receive(:create).and_raise(Stripe::StripeError.new("foo", :foo))
            post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: stripe_metadata }
          end

          let(:expected_flash_error) { "An error occured connecting to Stripe. Please email dogtag@chiditarod.org." }
          include_examples "redirects to prior url"
        end

        context "Something raises an uncaught error" do
          before do
            expect(Stripe::Charge).to receive(:create).and_raise
            post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: stripe_metadata }
          end

          let(:expected_flash_error) { "An error unrelated to processing your credit card has occured. Please email dogtag@chiditarod.org." }
          include_examples "redirects to prior url"
        end

        ERRORS = [
          :incorrect_number, :invalid_number, :invalid_expiry_month, :invalid_expiry_year,
          :invalid_cvc, :expired_card, :incorrect_cvc, :card_declined, :missing, :processing_error
        ]
        ERRORS.each do |e|
          context "when Stripe::CardError #{e}" do
            before do
              StripeMock.prepare_card_error(e)
              post :create, params: { amount: 5000, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: stripe_metadata }
            end

            it 'does not record a completed_requirement' do
              expect(CompletedRequirement.count).to eq(0)
            end

            it 'flashes the Stripe message' do
              expect(flash[:error]).to be_present
            end

            let(:expected_flash_error) { I18n.t "charges.#{e}" }
            include_examples "redirects to prior url"
          end
        end
      end
    end


    describe '#refund' do

      let(:valid_user) { FactoryBot.create :refunder_user }

      let(:charge) { Stripe::Charge.create(amount: 7000, currency: 'usd', source: stripe_helper.generate_card_token) }
      let(:cr) do
        FactoryBot.create :completed_requirement, charge_id: charge.id, amount_cents: 7000,
          metadata: JSON.generate('charge_id' => charge.id, 'amount' => 7000)
      end

      before do
        session[:prior_url] = '/prior_url/'
        StripeMock.start
        cr
      end
      after { StripeMock.stop }

      context 'when session[:prior_url] is not set' do
        let(:error_json) {{ errors: "The calling controller should set session[:prior_url] so this method knows where to return to. e.g. session[:prior_url] = request.original_url"}.to_json}
        it "renders 400 with json message" do
          session.delete(:prior_url)
          post :refund, params: { charge_id: charge.id }
          expect(response.status).to eq(400)
          expect(response.body).to eq(error_json)
          expect(cr.reload).not_to be_refunded
        end
      end

      it '404s for an unknown charge id' do
        post :refund, params: { charge_id: 'ch_nope' }

        expect(response.status).to eq(404)
        expect(JSON.parse(response.body)['error']).to include('ch_nope')
      end

      it 'refunds through the service and records refunded_by' do
        post :refund, params: { charge_id: charge.id }

        expect(flash[:notice]).to eq("The refund has processed successfully")
        expect(response).to redirect_to('/prior_url/')
        cr.reload
        expect(cr).to be_refunded
        expect(cr.refunded_by).to eq(valid_user)
        expect(cr.metadata['refunded']).to eq(true)
        expect(cr.metadata['charge_id']).to eq(charge.id)
        expect(Stripe::Charge.retrieve(charge.id).refunded).to eq(true)
        expect(Workers::PaymentRefundedEmail.jobs.size).to eq(1)
      end

      it 'reports already refunded without calling Stripe again' do
        cr.update!(refunded_at: 1.day.ago)
        expect(Stripe::Charge).not_to receive(:retrieve)
        expect(Stripe::Refund).not_to receive(:create)

        post :refund, params: { charge_id: charge.id }

        expect(flash[:notice]).to eq("This payment was already refunded")
        expect(response).to redirect_to('/prior_url/')
        expect(Workers::PaymentRefundedEmail.jobs).to be_empty
      end

      it "shows the service's message when Stripe fails" do
        cr.update_columns(charge_id: 'ch_seed_1')

        post :refund, params: { charge_id: 'ch_seed_1' }

        expect(flash[:error]).to include('ch_seed_1')
        expect(flash[:notice]).to be_nil
        expect(response).to redirect_to('/prior_url/')
        expect(cr.reload).not_to be_refunded
      end

      context 'when a racer asks' do
        let(:valid_user) { FactoryBot.create :user }

        it 'is denied and refunds nothing' do
          expect { post :refund, params: { charge_id: charge.id } }.to raise_error(CanCan::AccessDenied)

          expect(cr.reload).not_to be_refunded
          expect(Stripe::Charge.retrieve(charge.id).refunded).to eq(false)
        end
      end

      context 'when reopen is passed' do
        context 'and the user is an operator' do
          let(:the_user) { FactoryBot.create :operator_user }

          it 'refunds, reopens the payment and keeps the row as history' do
            post :refund, params: { charge_id: charge.id, reopen: true }

            expect(flash[:notice]).to eq("The refund has processed successfully, and the payment was reopened")
            expect(response).to redirect_to('/prior_url/')
            cr.reload
            expect(cr).to be_refunded
            expect(cr).to be_reopened
            expect(cr.reopened_by).to eq(the_user)
            expect(cr.team.completed_requirements).to be_empty
          end

          it 'only refunds when reopen is "false"' do
            post :refund, params: { charge_id: charge.id, reopen: 'false' }

            expect(flash[:notice]).to eq("The refund has processed successfully")
            expect(cr.reload).to be_refunded
            expect(cr).not_to be_reopened
          end

          it 'does not reopen when the refund fails' do
            cr.update_columns(charge_id: 'ch_seed_1')

            post :refund, params: { charge_id: 'ch_seed_1', reopen: true }

            expect(flash[:error]).to be_present
            expect(cr.reload).not_to be_reopened
          end
        end

        context 'when the user is a refunder' do
          it 'refunds but does not reopen, and says why' do
            post :refund, params: { charge_id: charge.id, reopen: true }

            expect(flash[:notice]).to eq("The refund has processed successfully, but the payment was not reopened because you do not have the appropriate permissions")
            expect(cr.reload).to be_refunded
            expect(cr).not_to be_reopened
          end
        end
      end
    end

    describe '#reopen' do
      let(:valid_user) { FactoryBot.create :operator_user }
      let(:cr) { FactoryBot.create :completed_requirement, charge_id: 'ch_1', amount_cents: 7000, refunded_at: Time.current }

      before { session[:prior_url] = '/prior_url/' }

      it 'reopens a refunded payment' do
        post :reopen, params: { id: cr.id }

        expect(flash[:notice]).to eq("The payment was reopened. The team can pay again.")
        expect(response).to redirect_to('/prior_url/')
        expect(cr.reload).to be_reopened
      end

      it 'refuses a payment that was not refunded' do
        cr.update_columns(refunded_at: nil)

        post :reopen, params: { id: cr.id }

        expect(flash[:error]).to eq("Only a refunded payment can be reopened.")
        expect(cr.reload).not_to be_reopened
      end

      context 'when a refunder asks' do
        let(:valid_user) { FactoryBot.create :refunder_user }

        it 'is denied and reopens nothing' do
          expect { post :reopen, params: { id: cr.id } }.to raise_error(CanCan::AccessDenied)
          expect(cr.reload).not_to be_reopened
        end
      end
    end
  end
end
