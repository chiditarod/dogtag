# Copyright (C) 2015 Devin Breen
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

describe Customer do

  describe 'self.get' do
    let(:stripe_helper) { StripeMock.create_test_helper }
    let(:token) { stripe_helper.generate_card_token }

    before do
      Stripe.api_key = 'abc123' # hack, see: https://github.com/rebelidealist/stripe-ruby-mock/issues/209
      StripeMock.start
    end
    after { StripeMock.stop }

    context 'when stripe cannot create a new customer' do
      let(:user) { FactoryBot.create :user }
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
      let(:user) { FactoryBot.create :user, stripe_customer_id: customer.id }
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
      let(:user) { FactoryBot.create :user }

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
      let(:user) { FactoryBot.create :user, stripe_customer_id: customer.id }

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
