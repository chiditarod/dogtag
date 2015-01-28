require 'spec_helper'
require 'stripe_mock'

describe Customer do
  class << self

    describe '#get' do
      let(:stripe_helper) { StripeMock.create_test_helper }
      let(:token) { stripe_helper.generate_card_token }
      before { StripeMock.start }
      after { StripeMock.stop }

      context 'when stripe cannot create a new customer' do
        let(:user) { FactoryGirl.create :user }
        before do
          expect(Stripe::Customer).to receive(:create).and_return(nil)
        end

        it 'returns nil' do
          expect(Customer.get(user, token, 'email')).to be_nil
        end
      end

      context 'when stripe cannot retrieve a customer' do
        let(:customer) do
          Stripe::Customer.create({
            card: stripe_helper.generate_card_token,
            email: 'email@foo.com'
          })
        end
        let(:user) { FactoryGirl.create :user, stripe_customer_id: customer.id }
        before do
          expect(Stripe::Customer).to receive(:retrieve).and_return(nil)
        end

        it 'returns nil' do
          expect(Customer.get(user, token, 'email')).to be_nil
        end
      end

      context 'when user is not yet a stripe customer' do
        let(:customer) do
          Stripe::Customer.create({
            card: stripe_helper.generate_card_token,
            email: 'email@foo.com'
          })
        end
        let(:user) { FactoryGirl.create :user }

        it 'creates a stripe customer, saves it to the user, and returns the customer' do
          expect(Stripe::Customer).to receive(:create).and_return(customer)
          result = Customer.get(user, token, 'email')
          expect(result).to eq(customer)
          expect(User.find(user.id).stripe_customer_id).to eq(customer.id)
        end
      end

      context 'when the user already is a stripe customer' do
        let(:customer) do
          Stripe::Customer.create({
            card: stripe_helper.generate_card_token,
            email: 'email@foo.com'
          })
        end
        let(:user) { FactoryGirl.create :user, stripe_customer_id: customer.id }

        it 'updates customer with new token, saves, and returns the customer' do
          expect(Stripe::Customer).to receive(:retrieve).with(user.stripe_customer_id).and_return(customer)
          expect(customer).to receive(:card=).with(token)
          expect(customer).to receive(:save).and_return(customer)
          result = Customer.get(user, token, 'email')
          expect(result).to eq(customer)
        end
      end
    end
  end
end
