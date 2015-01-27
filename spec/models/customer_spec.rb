require 'spec_helper'

describe Customer do
  class << self

    describe '#find_by_customer_id' do
      let(:customer) { double(Customer, id: 1) }
      let(:user) { FactoryGirl.create :user, stripe_customer_id: 1 }

      context 'when customer_id is nil' do
        it 'returns nil' do
          expect(Customer.find_by_customer_id(nil)).to be_nil
        end
      end

      context 'when stripe finds the customer_id' do
        before do
          expect(Stripe::Customer).to receive(:retrieve)
            .with(customer.id).and_return(customer)
        end
        it 'returns the customer' do
          expect(Customer.find_by_customer_id(customer.id)).to eq(customer)
        end
      end

      context 'when stripe cannot find the customer_id' do
        before do
          expect(Stripe::Customer).to receive(:retrieve)
            .with(customer.id).and_return(nil)
        end

        it 'returns nil' do
          expect(Customer.find_by_customer_id(customer.id)).to be_nil
        end
      end
    end

    describe '#create_new_customer' do
      let(:customer) { double(Customer, id: 'cus_abcdefghijklmn') }
      let(:user) { FactoryGirl.create :user }
      let(:endpoint) do
        Customer.create_new_customer(user, 'some-token', 'foo@bar.com')
      end

      context 'stripe successfully creates the customer' do
        before do
          expect(Stripe::Customer).to receive(:create).and_return(customer)
        end

        it 'saves the customer id to the user object' do
          expect(user.stripe_customer_id).to be_nil
          customer = endpoint
          expect(user.reload.stripe_customer_id).to eq(customer.id)
        end

        it 'returns the created customer' do
          expect(endpoint).to eq(customer)
        end
      end

      context 'stripe is unable to create customer' do
        before do
          expect(Stripe::Customer).to receive(:create).and_return(nil)
        end

        it 'returns nil' do
          expect(endpoint).to be_nil
        end
      end
    end
  end
end
