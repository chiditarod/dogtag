Rails.application.routes.draw do
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html

  get 'users/search', to: 'users#search', as: 'search_users'
  get 'teams/search', to: 'teams#search', as: 'search_teams'
  
  # The racer-facing front door is the SPA; keep the route name for home_url callers
  root to: redirect("/register"), as: :home

  # Handle non-GET requests to root (malicious traffic like androxgh0st scanners)
  match "/", to: "errors#not_found", via: [:post, :put, :patch, :delete]

  # team pages moved to the SPA; old bookmarks and emailed links land there
  get "teams", to: redirect("/register/teams")
  get "teams/new", to: redirect { |_params, req|
    race_id = req.params[:race_id].to_s
    race_id.match?(/\A\d+\z/) ? "/register/races/#{race_id}/teams/new" : "/register"
  }
  get "teams/:id", to: redirect("/register/teams/%{id}"), constraints: { id: /\d+/ }
  get "teams/:id/*rest", to: redirect("/register/teams/%{id}"), constraints: { id: /\d+/ }, format: false

  # Race staff pages stay (new, edit, export, requirements) until the staff reskin; the racer
  # race list, race page and registrations list moved to the SPA. Kept routes come first.
  resources :races, :only => [:new, :create, :edit, :update, :destroy] do
    get :export
    resources :requirements, :only => [:new, :create, :edit, :update, :destroy]
  end
  get "races", to: redirect("/register")
  get "races/:id", to: redirect("/register"), constraints: { id: /\d+/ }
  get "races/:race_id/registrations", to: redirect("/register/races/%{race_id}/registrations"), constraints: { race_id: /\d+/ }

  resources :tiers, :only => [:new, :create, :edit, :update, :destroy]

  # user accounts: staff user admin stays; racer account pages moved to the SPA
  resources :users, :only => [:index, :destroy]
  get "users/new", to: redirect("/register/signup")
  get "users/:id", to: redirect("/register/account"), constraints: { id: /\d+/ }
  get "users/:id/edit", to: redirect("/register/account"), constraints: { id: /\d+/ }
  get "account", to: redirect("/register/account")
  get "account/edit", to: redirect("/register/account")
  resource :user_session, :only => [:destroy]
  get "user_session/new", to: redirect("/register/login")
  get "login", to: redirect("/register/login")

  # password reset (the SPA handles it; old emailed links still land there)
  get "password_resets/new", to: redirect("/register/forgot-password")
  get "password_resets/:token/edit", to: redirect("/register/reset-password/%{token}"), constraints: { token: /[A-Za-z0-9_-]+/ }

  # sidekiq
  mount Sidekiq::Web => '/sidekiq'

  resources :sent_emails, only: [:index]

  #resources :foos, :only => [:index, :new, :create, :show, :edit, :update, :delete]

  # The priority is based upon order of creation: first created -> highest priority.
  # See how all your routes lay out with "rake routes".

  # You can have the root of your site routed with "root"
  # root 'welcome#index'

  # Example of regular route:
  #   get 'products/:id' => 'catalog#view'

  # Example of named route that can be invoked with purchase_url(id: product.id)
  #   get 'products/:id/purchase' => 'catalog#purchase', as: :purchase

  # Example resource route (maps HTTP verbs to controller actions automatically):
  #   resources :products

  # Example resource route with options:
  #   resources :products do
  #     member do
  #       get 'short'
  #       post 'toggle'
  #     end
  #
  #     collection do
  #       get 'sold'
  #     end
  #   end

  # Example resource route with sub-resources:
  #   resources :products do
  #     resources :comments, :sales
  #     resource :seller
  #   end

  # Example resource route with more complex sub-resources:
  #   resources :products do
  #     resources :comments
  #     resources :sales do
  #       get 'recent', on: :collection
  #     end
  #   end

  # Example resource route with concerns:
  #   concern :toggleable do
  #     post 'toggle'
  #   end
  #   resources :posts, concerns: :toggleable
  #   resources :photos, concerns: :toggleable

  # Example resource route within a namespace:
  #   namespace :admin do
  #     # Directs /admin/products/* to Admin::ProductsController
  #     # (app/controllers/admin/products_controller.rb)
  #     resources :products
  #   end

  # JSON API consumed by the React SPA
  namespace :api, defaults: { format: :json } do
    namespace :v1 do
      get "csrf", to: "csrf#show"
      get "me", to: "sessions#show"
      patch "me", to: "accounts#update"
      resource :session, only: [:create, :destroy]
      resources :users, only: [:create]
      resources :password_resets, only: [:create, :show, :update]
      resources :feedback, only: [:create]
      resources :races, only: [:index, :show] do
        resources :registrations, only: [:index]
      end
      resources :teams, only: [:index, :show, :create, :update, :destroy] do
        resources :people, only: [:create, :update, :destroy]
        resource :captain, only: [:update]
        resources :past_racers, only: [:index]
        resource :questions, only: [:show, :update]
        resource :buddy_options, only: [:show]
        resources :payments, only: [:create]
        resource :confirmation, only: [:create]
        resources :mock_payments, only: [:create] if Rails.env.development? || Rails.env.test?
      end
      namespace :staff do
        resources :payments, only: [:index]
        resources :users, only: [:index, :show, :update, :destroy]
        resources :teams, only: [:show]
        resources :sent_emails, only: [:index]
        resources :races, only: [:index, :new, :show, :create, :update, :destroy] do
          get :export, on: :member, defaults: { format: :csv }
          resources :requirements, only: [:index, :create]
        end
        resources :requirements, only: [:show, :update, :destroy] do
          resources :tiers, only: [:create]
        end
        resources :tiers, only: [:update, :destroy]
        post :confirmation_preview, to: "confirmation_previews#create"
        resources :refund_batches, only: [:create, :show] do
          # `retry` is a Ruby keyword, so the action is retry_failed.
          post :retry, on: :member, action: :retry_failed
        end
      end
      match "*path", to: "base#route_not_found", via: :all
    end
  end

  # React registration SPA (client-side routing; served by SpaController)
  get "register", to: "spa#index"
  get "register/*path", to: "spa#index"

  # Catch-all route for unmatched paths - returns 404 without raising exception
  # This prevents ActionController::RoutingError from being logged to Rollbar
  # Must be last route in the file
  match "*path", to: "errors#not_found", via: :all
end
