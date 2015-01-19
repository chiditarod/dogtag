class Customer
  class << self

    def find_by_customer_id(customer_id)
      return nil if customer_id.nil?
      Stripe::Customer.retrieve(customer_id)
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
