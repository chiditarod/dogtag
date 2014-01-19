class ApplicationController < ActionController::Base
  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception
  helper :all
  helper_method :current_user_session, :current_user

  # supposed fix for cancan and rails4
  before_filter do
    resource = controller_name.singularize.to_sym
    method = "#{resource}_params"
    params[resource] &&= send(method) if respond_to?(method, true)
  end

  rescue_from CanCan::AccessDenied do |exception|
    redirect_to home_url, :alert => exception.message
  end

  # let's catch errors and route nicely in production
  #unless Rails.configuration.consider_all_requests_local
  if true
    rescue_from Exception, :with => :render_error
    rescue_from ActiveRecord::RecordNotFound, :with => :render_not_found
    rescue_from ActionController::RoutingError, :with => :render_not_found
    rescue_from ActionController::UnknownController, :with => :render_not_found
  end

  private

  def render_not_found(ex)
    log_error(ex)
    render template: "/error/404.html.erb", status: 404
  end

  def render_error(ex)
    log_error(ex)
    render template: "/error/500.html.erb", status: 500
  end

  def log_error(ex)
    Rails.logger.error "#{ex.class} #{ex.message}"
  end

  ## user/session stuff -----------------------------------------

  def current_user_session
    return @current_user_session if defined? @current_user_session
    @current_user_session = UserSession.find
  end

  def current_user
    return @current_user if defined? @current_user
    @current_user = current_user_session && current_user_session.record
  end

  def require_user
    unless current_user
      store_location
      flash[:notice] = "You must be logged in to access this page"
      redirect_to new_user_session_path
      return false
    end
  end

  def require_no_user
    if current_user
      flash[:notice] = "You must be logged out to access this page"
      redirect_back_or_default account_url
      return false
    end
  end

  def store_location
    session[:return_to] = request.original_url
    #todo: remove this logging once it works
    logger.info "-----------------"
    logger.info session[:return_to]
    logger.info "-----------------"
  end

  def redirect_back_or_default(default)
    # todo: get this working (see user_session specs)
    #puts "session return_to: #{session[:return_to]}"
    redirect_to(session[:return_to] || default)
    session[:return_to] = nil
  end
end
