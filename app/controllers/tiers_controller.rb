class TiersController < ApplicationController
  before_filter :require_user

  def destroy
    @tier = Tier.find params[:id]
    return render :status => 400 if @tier.nil?

    if @tier.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t 'destroy_failed'
    end
    redirect_to edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t 'not_found'
    render :status => 400
  end

  def update
    return render :status => 400 unless params[:tier]
    @tier = Tier.find(params[:id])

    if @tier.update_attributes tier_params
      flash[:notice] = I18n.t('update_success')
      redirect_to edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id
    else
      puts @tier.errors.inspect
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @tier.errors.messages
    end
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def edit
    @tier = Tier.find params[:id]
    @requirement = @tier.requirement
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    return render :status => 400
  end

  def new
    @requirement = Requirement.find params[:requirement_id]
    @tier = Tier.new
    @tier.requirement = @requirement
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    return render :status => 400
  end

  def create
    return render :status => 400 if params[:tier].blank?

    begin
      @requirement = Requirement.find tier_params[:requirement_id]
    rescue ActiveRecord::RecordNotFound
      flash[:error] = t('requirement_not_found')
      return render :status => 400
    end

    @tier = Tier.new tier_params
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
