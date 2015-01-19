require 'spec_helper'
require 'stripe_mock'

describe ChargesController do

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
      let(:endpoint) { lambda { post :refund, charge_id: 1 }}
      include_examples 'redirects to login'
    end
  end

  context '[logged in]' do
    shared_examples "redirects to prior url" do
      it 'redirects to the prior url' do
        expect(response).to redirect_to('/prior_url/')
      end
    end

    let(:valid_user) { FactoryGirl.create :user }
    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#create' do

      context 'when stripe cannot find or create a customer' do
        before do
          expect(Customer).to receive(:find_by_customer_id).and_return nil
          expect(Customer).to receive(:create_new_customer).and_return nil
          session[:prior_url] = '/prior_url/'
          post :create, amount: 10, stripeToken: 'foo', stripeEmail: 'bar', description: 'hi', metadata: {bat: :baz}
        end

        it 'renders flash error' do
          expect(flash[:error]).to eq(I18n.t 'charges.unable_to_get_customer')
        end

        include_examples "redirects to prior url"
      end

      ChargesController::STRIPE_PARAMS.each do |param|
        let(:valid_params) do
          {
            'amount' => 10,
            'stripeToken' => 'foo',
            'stripeEmail' => 'bar',
            'description' => 'hi',
            'metadata' => {
              'bat' => 'baz'
            }
          }
        end

        context "when params['#{param}'] is missing from request" do
          before do
            post :create, valid_params.except(param)
          end

          it "render a json error" do
            json = JSON.parse(response.body)
            expect(json['errors']).to eq("Missing required stripe parameter(s): #{param}")
          end
          it "returns bad request" do
            expect(response.status).to eq(400)
          end
        end
      end

      context "when Charge is successful" do
        let(:stripe_helper) { StripeMock.create_test_helper }

        let(:requirement) { FactoryGirl.create :payment_requirement }
        let(:team) { FactoryGirl.create :team, race: requirement.race }

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
            amount:      '7000',
            description: 'Registration Fee for Arizona Quints | Chiditarod X',
            metadata: {
              race_name: team.race.name,
              team_name: team.name,
              requirement_id: requirement.id,
              team_id: team.id
            },
            currency:    'usd'
          })
        end

        before do
          StripeMock.start
          expect(Customer).to receive(:find_by_customer_id).and_return customer
          expect(Stripe::Charge).to receive(:create).and_return(charge)
          session[:prior_url] = '/prior_url/'

          expect(CompletedRequirement.count).to eq(0)

          post :create, amount: '7000', stripeToken: 'foo',
            stripeEmail: customer.email, description: 'hi',
            metadata: {
              team_id: team.id,
              requirement_id: requirement.id
            }.to_json
        end
        after { StripeMock.stop }

        it 'assigns cr_metadata' do
          cr_metadata = {
            'customer_id' => customer.id,
            'charge_id' => charge.id,
            'amount' => '7000'
          }
          expect(assigns(:cr_metadata)).to eq(cr_metadata)
        end

        it 'creates and saves the completed_requirement' do
          # this is brittle, but we need something.
          expect(CompletedRequirement.count).to eq(1)
        end

        it 'stores the charge details in cr_metadata' do
          data = assigns(:cr_metadata)
          expect(data['customer_id']).to eq(customer.id)
          expect(data['charge_id']).to eq(charge.id)
          expect(data['amount']).to eq('7000')
        end

        it 'renders flash notice' do
          expect(flash[:notice]).to eq('Your card has been charged successfully.')
        end

        include_examples "redirects to prior url"
      end

      shared_examples 'logs an error' do
        before do
          expect(StripeHelper).to receive(:log_charge_error)
        end
      end

      context "Stripe Errors" do
        let(:stripe_helper) { StripeMock.create_test_helper }
        let(:customer) do
          Stripe::Customer.create({
            card: stripe_helper.generate_card_token,
            email: 'musher@chiditarod.com',
            metadata: {
              user_id: 1
            }
          })
        end
        before { StripeMock.start }
        after { StripeMock.stop }

        context "Stripe returns invalid request" do
          include_examples 'logs an error'

          before do
            expect(Customer).to receive(:find_by_customer_id).and_return customer
            expect(Stripe::Charge).to receive(:create).and_raise(Stripe::InvalidRequestError.new(I18n.t("foo"), :foo))
            session[:prior_url] = '/prior_url/'
            post :create, amount: 10, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: {bat: :baz}.to_json
          end

          it 'renders flash error' do
            expect(flash[:error]).to eq("An error occured processing your credit card. Please try again.")
          end

          include_examples "redirects to prior url"
        end

        context "Stripe returns API connection error" do
          include_examples 'logs an error'
          before do
            expect(Customer).to receive(:find_by_customer_id).and_return customer
            expect(Stripe::Charge).to receive(:create).and_raise(Stripe::APIConnectionError.new("foo", :foo))
            session[:prior_url] = '/prior_url/'
            post :create, amount: 10, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: {bat: :baz}.to_json
          end

          it 'renders flash error' do
            expect(flash[:error]).to eq('We could not connect to the Stripe API. Please try again.')
          end

          include_examples "redirects to prior url"
        end

        context "Stripe returns generic StripeError" do
          include_examples 'logs an error'
          before do
            expect(Customer).to receive(:find_by_customer_id).and_return customer
            expect(Stripe::Charge).to receive(:create).and_raise(Stripe::StripeError.new("foo", :foo))
            session[:prior_url] = '/prior_url/'
            post :create, amount: 10, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: {bat: :baz}.to_json
          end

          it 'renders flash error' do
            expect(flash[:error]).to eq('An error occured connecting to Stripe. Please email dogtag@chiditarod.org.')
          end

          include_examples "redirects to prior url"
        end

        context "Something raises an uncaught error" do
          include_examples 'logs an error'
          before do
            expect(Customer).to receive(:find_by_customer_id).and_return customer
            expect(Stripe::Charge).to receive(:create).and_raise
            session[:prior_url] = '/prior_url/'
            post :create, amount: 10, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: {bat: :baz}.to_json
          end

          it 'renders flash error' do
            expect(flash[:error]).to eq('An error unrelated to processing your credit card has occured. Please email dogtag@chiditarod.org.')
          end

          include_examples "redirects to prior url"
        end

        ERRORS = [
          :incorrect_number, :invalid_number, :invalid_expiry_month, :invalid_expiry_year,
          :invalid_cvc, :expired_card, :incorrect_cvc, :card_declined, :missing, :processing_error
        ]
        ERRORS.each do |e|
          context "when Stripe::CardError #{e}" do
            include_examples 'logs an error'
            before do
              StripeMock.prepare_card_error(e)
              expect(Customer).to receive(:find_by_customer_id).and_return customer
              session[:prior_url] = '/prior_url/'
              post :create, amount: 10, stripeToken: 'foo', stripeEmail: customer.email, description: 'hi', metadata: {bat: :baz}.to_json
            end

            it 'assigns customer' do
              expect(assigns(:customer)).to eq(customer)
            end

            it 'renders flash error' do
              expect(flash[:error]).to eq(I18n.t "charges.#{e}")
            end

            include_examples "redirects to prior url"
          end
        end
      end
    end

    describe '#refund' do
      it 'calls stripe refund successfully'
      it 'redirects to prior_url'
      it 'sets refunded on charge object'
      it 'returns 404 if the charge_id cannot be found'
      it 'returns 400 if the charge_id is already refunded'
      it 'destroys the associated completed_requirement'
    end
  end
end
