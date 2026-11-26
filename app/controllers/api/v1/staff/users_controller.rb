# The staff users list and detail (refunder, operator, admin). Changing and deleting users is admin only.
class Api::V1::Staff::UsersController < Api::V1::Staff::BaseController
  # Checked before the loader, so a role that may not look learns nothing about which ids exist.
  before_action -> { authorize!(:index, User) }, only: [:index]
  before_action -> { authorize!(:show, User) }, only: [:show]
  before_action :load_user, only: [:show]

  def index
    search = Users::StaffSearch.new(q: params[:q], page: params[:page])
    @users = search.users
    @meta = search.meta
  end

  def show
    authorize!(:show, @user)
  end

  private

  def load_user
    @user = User.find(params[:id])
  end
end
