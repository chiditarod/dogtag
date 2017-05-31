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
class Customer
  class << self

    def get(user, stripe_token, stripe_email)

      if user.stripe_customer_id.nil?
        return create_new_customer(user, stripe_token, stripe_email)
      end

      customer = Stripe::Customer.retrieve(user.stripe_customer_id)
      return nil if customer.nil?

      # update the customer with new token and email
      # todo: we should probably only update this when a
      # user's charge fails instead of all the time.
      customer.card = stripe_token
      customer.email = stripe_email
      customer.save
    end

    private

    def create_new_customer(current_user, stripe_token, stripe_email)
      user = User.find(current_user.id)
      customer = Stripe::Customer.create(
        card: stripe_token,
        email: stripe_email,
        metadata: {
          user_id: user.id
        }
      )
      return nil if customer.nil?

      user.stripe_customer_id = customer.id
      user.save!

      if user.stripe_customer_id.nil?
        user.stripe_customer_id = customer.id
        user.save
      else
        Rails.logger.error "ERROR: User ID #{user.id} has a customer_id but we are inside create_new_customer."
      end

      customer
    end
  end
end
