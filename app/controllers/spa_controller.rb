# Serves the React registration SPA (built by Vite into public/register).
class SpaController < ActionController::Base
  # GET-only, no session state; also avoids the cross-origin JS check returning 422 for .js misses.
  skip_forgery_protection

  def self.index_path
    Rails.root.join("public", "register", "index.html")
  end

  def index
    if ENV["VITE_DEV_SERVER"].present?
      redirect_to "#{ENV["VITE_DEV_SERVER"]}#{request.fullpath}", allow_other_host: true
    elsif File.extname(request.path).present?
      # Only HTML navigations get the SPA shell; missing assets must 404.
      head :not_found
    elsif File.exist?(self.class.index_path)
      render file: self.class.index_path, layout: false, content_type: "text/html"
    else
      render plain: "Registration app not built. Run: npm --prefix frontend run build", status: :service_unavailable
    end
  end
end
