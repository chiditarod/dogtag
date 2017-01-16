unless Rails.env.test?
  unless ENV['STRIPE_PUBLISHABLE_KEY'] && ENV['STRIPE_SECRET_KEY']
    raise ArgumentError, "Must provide 'STRIPE_PUBLISHABLE_KEY' and 'STRIPE_SECRET_KEY' environment variables to use Stripe"
  end
end

Rails.configuration.stripe = {
  :publishable_key => ENV['STRIPE_PUBLISHABLE_KEY'],
  :secret_key      => ENV['STRIPE_SECRET_KEY']
}

Stripe.api_key = Rails.configuration.stripe[:secret_key]
