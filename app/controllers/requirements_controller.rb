class RequirementsController < ApplicationController
  before_filter :require_user

  def destroy
    @requirement = Requirement.find params[:id]
    return render :status => 400 if @requirement.nil?

    if @requirement.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t 'destroy_failed'
    end
    redirect_to race_url :id => @requirement.race.id
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t 'not_found'
    render :status => 400
  end

  def update
    return render :status => 400 unless params[:requirement]
    @requirement = Requirement.find(params[:id])

    @race = @requirement.race

    if @requirement.update_attributes requirement_params
      flash[:notice] = I18n.t('update_success')
      redirect_to race_url :id => @requirement.race.id
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @requirement.errors.messages
    end
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def edit
    @requirement = Requirement.find params[:id]
    @race = @requirement.race
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    return render :status => 400
  end

  def new
    @race = Race.find params[:race_id]
    @requirement = Requirement.new
  end

  def create
    return render :status => 400 if params[:requirement].blank?

    @race = Race.find params[:race_id]
    return render :status => 400 if @race.nil?

    @requirement = Requirement.new requirement_params
    @requirement.race = @race

    if @requirement.save
      flash[:notice] = I18n.t('create_success')
      redirect_to race_url(:id => @race.id)
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @requirement.errors.messages
      puts @requirement.errors.messages
    end
  end

  private

  def requirement_params
    params.require(:requirement).permit(:name)
  end
end
