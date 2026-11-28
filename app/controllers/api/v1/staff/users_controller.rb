# The staff users list and detail (refunder, operator, admin). Changing and deleting users is admin only.
class Api::V1::Staff::UsersController < Api::V1::Staff::BaseController
  # Checked before the loader, so a role that may not look learns nothing about which ids exist.
  before_action -> { authorize!(:index, User) }, only: [:index]
  before_action -> { authorize!(:show, User) }, only: [:show]
  # :staff_update has no Ability rule on purpose: it is admin-only through `can :manage, :all`. Never use :update here.
  before_action -> { authorize!(:staff_update, User) }, only: [:update]
  before_action -> { authorize!(:destroy, User) }, only: [:destroy]
  before_action :load_user, only: [:show, :update, :destroy]

  def index
    search = Users::StaffSearch.new(q: params[:q], page: params[:page])
    @users = search.users
    @meta = search.meta
  end

  def show
    authorize!(:show, @user)
  end

  def update
    authorize!(:staff_update, @user)
    attrs = params.expect(user: [:first_name, :last_name, :email, :phone, { roles: [] }])
    roles = attrs.delete(:roles)
    @user.assign_attributes(attrs)
    @user.valid?
    add_role_errors(roles)

    return render_errors(@user) unless @user.errors.empty?

    @user.roles = roles unless roles.nil?
    if @user.save_without_session_maintenance
      render :update
    else
      render_errors(@user)
    end
  end

  def destroy
    authorize!(:destroy, @user)
    if (reason = @user.deletion_blocker(by: current_user))
      render_errors(reason, code: "user_not_deletable")
    elsif @user.destroy
      head :no_content
    else
      render_errors(@user.errors.full_messages.to_sentence)
    end
  end

  private

  def add_role_errors(roles)
    return if roles.nil?

    unknown = roles - User.valid_roles.map(&:to_s)
    unknown.each { |role| @user.errors.add(:roles, "isn't a role: #{role}") }
    return unless unknown.empty? && @user == current_user && roles.exclude?("admin")

    @user.errors.add(:roles, "You can't remove your own Admin role")
  end

  def load_user
    @user = User.find(params[:id])
  end
end
