# Serves the React registration SPA (built by Vite into public/register).
class SpaController < ActionController::Base
  def index
    if ENV["VITE_DEV_SERVER"].present?
      redirect_to "#{ENV["VITE_DEV_SERVER"]}#{request.fullpath}", allow_other_host: true
    else
      spa_path = Rails.root.join("public", "register", "index.html")
      if File.exist?(spa_path)
        render file: spa_path, layout: false, content_type: "text/html"
      else
        render plain: "Registration app not built. Run: npm --prefix frontend run build", status: :service_unavailable
      end
    end
  end
end
