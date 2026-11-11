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

      customer = retrieve_customer(user)
      return replace_missing_customer(user, stripe_token, stripe_email) if customer == :missing
      return nil if customer.nil?

      # update the customer with new token and email
      # todo: we should probably only update this when a
      # user's charge fails instead of all the time.
      customer.card = stripe_token
      customer.email = stripe_email
      customer.save
    end

    private

    # Returns the Stripe customer, nil, or :missing when Stripe no longer has
    # the saved customer (e.g. deleted in the dashboard, or a live-mode id
    # used with test-mode keys).
    def retrieve_customer(user)
      customer = Stripe::Customer.retrieve(user.stripe_customer_id)
      customer.respond_to?(:deleted) && customer.deleted ? :missing : customer
    rescue Stripe::InvalidRequestError => e
      raise unless e.http_status == 404 || e.message.match?(/No such customer/i)

      :missing
    end

    def replace_missing_customer(user, stripe_token, stripe_email)
      Rails.logger.warn "Stripe customer #{user.stripe_customer_id} for user ID #{user.id} is missing; creating a new customer."
      user.update_column(:stripe_customer_id, nil)
      customer = create_new_customer(user, stripe_token, stripe_email)
      user.stripe_customer_id = customer&.id # keep the caller's in-memory record in sync
      user.clear_attribute_changes([:stripe_customer_id])
      customer
    end

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

      user.update!(stripe_customer_id: customer.id)

      customer
    end
  end
end
