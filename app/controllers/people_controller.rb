class PeopleController < ApplicationController
  before_filter :require_user
  load_and_authorize_resource

  def destroy
    @person = Person.find params[:id]

    if @person.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t 'destroy_failed'
    end
    redirect_to team_url :id => @person.team.id
  end

  def update
    @person = Person.includes(:team).find(params[:id])
    @team = @person.team
    try_to_update(@person, person_params, team_url(@person.team.id))
  end

  def edit
    @person = Person.includes(:team).find(params[:id])
    @team = @person.team
  end

  def new
    @team = Team.find params[:team_id]
    @person = Person.new
  end

  def create
    return render :status => 400 if params[:person].blank?

    @team = Team.find params[:team_id]
    @person = Person.new person_params
    @person.team = @team

    if @person.save
      flash[:notice] = I18n.t('create_success')
      redirect_to team_url :id => @person.team.id
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @person.errors.messages
    end
  end

  private

  def person_params
    params
      .require(:person)
      .permit(:first_name, :last_name, :email, :phone, :twitter, :experience, :zipcode)
  end
end
