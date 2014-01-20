class RequirementsController < ApplicationController
  before_filter :require_user

  load_and_authorize_resource :race
  load_and_authorize_resource :requirement, :through => :race

  def destroy
    @requirement = Requirement.find params[:id]

    if @requirement.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t 'destroy_failed'
    end
    redirect_to race_url :id => @requirement.race.id
  end

  def update
    @requirement = Requirement.find(params[:id])

    @race = @requirement.race

    if @requirement.update_attributes requirement_params
      flash[:notice] = I18n.t('update_success')
      redirect_to race_url :id => @requirement.race.id
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @requirement.errors.messages
    end
  end

  def edit
    @requirement = Requirement.find params[:id]
    @race = @requirement.race
  end

  def new
    @race = Race.find params[:race_id]
    @requirement = Requirement.new
    @requirement.race = @race
  end

  def create
    return render :status => 400 if params[:requirement].blank?

    @race = Race.find params[:race_id]
    return render :status => 400 if @race.nil?

    @requirement = Requirement.new requirement_params
    @requirement.race = @race

    if @requirement.save
      flash[:notice] = I18n.t('create_success')
      redirect_to edit_race_requirement_url(:race_id => @requirement.race.id, :id => @requirement.id)
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @requirement.errors.messages
      puts @requirement.errors.messages
    end
  end

  private

  def requirement_params
    params.require(:requirement).permit(:name, :type)
  end
end
