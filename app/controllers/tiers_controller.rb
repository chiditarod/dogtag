class TiersController < ApplicationController
  before_filter :require_user
  load_and_authorize_resource

  def destroy
    @tier = Tier.find(params[:id])
    redirect_url = edit_race_requirement_url(race_id: @tier.requirement.race.id, id: @tier.requirement.id)
    try_to_delete(@tier, redirect_url)
  end

  def update
    @tier = Tier.find(params[:id])
    try_to_update(@tier, tier_params, edit_race_requirement_url(race_id: @tier.requirement.race.id, id: @tier.requirement.id))
  end

  def edit
    @tier = Tier.find(params[:id])
    @requirement = @tier.requirement
  end

  def new
    @requirement = Requirement.find(params[:requirement_id])
    @tier = Tier.new
    @tier.requirement = @requirement
  end

  def create
    begin
      @requirement = Requirement.find(tier_params[:requirement_id])
    rescue ActiveRecord::RecordNotFound
      flash[:error] = t('requirement_not_found')
      return render :status => 400
    end

    @tier = Tier.new(tier_params)
    @tier.requirement = @requirement

    if @tier.save
      flash[:notice] = I18n.t('create_success')
      redirect_to edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @tier.errors.messages
    end
  end

  private

  def tier_params
    params.require(:tier).permit(:price, :begin_at, :requirement_id)
  end
end
