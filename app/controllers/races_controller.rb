require 'csv'

class RacesController < ApplicationController
  before_filter :require_user, :except => [:index, :show]
  load_and_authorize_resource

  def index
    @past_races = Race.past.order('created_at DESC').includes(:teams)
    @current_races = Race.current.order('created_at DESC').includes(:teams)
  end

  def show
    @race = Race.find params[:id]
    if current_user
      @my_race_teams = @race.teams.where(:id => current_user.team_ids)
    end
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    redirect_to races_path
  end

  alias edit show

  def new
    @race = Race.new
  end

  def registrations
    @race = Race.find params[:race_id]
    @finalized_teams = Team.all_finalized.where(race_id: @race.id).order('updated_at DESC')
    @waitlisted_teams = Team.all_unfinalized.where(race_id: @race.id).order('updated_at DESC')
  end

  def export
    return render :status => 400 if params[:race_id].blank?

    race_id = params[:race_id]
    teams = params[:finalized] ? Team.export(race_id, :finalized => true) : Team.export(race_id)
    data = CSV.generate do |csv|
      teams.each { |i| csv << i }
    end
    send_data data, :type => 'text/csv; charset=utf-8; header=present', :disposition => "attachment; filename=race_#{race_id}_export.csv"
  end

  def create
    return render :status => 400 if params[:race].blank?

    @race = Race.new race_params
    if @race.save
      flash[:notice] = I18n.t('create_success')
      return redirect_to races_path
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @race.errors.messages
    end
  end

  def update
    @race = Race.find params[:id]
    if @race.update_attributes(race_params)
      flash[:notice] = t('update_success')
      return redirect_to race_url(@race)
    else
      flash[:error] = [t('update_failed')]
      flash[:error] << @race.errors.messages
    end
  end

  def destroy
    @race = Race.find params[:id]

    if @race.destroy
      flash[:notice] = t '.delete_success'
    else
      flash[:error] = t '.destroy_failed'
    end
    redirect_to races_path
  end

  private

  def race_params
    params.require(:race).permit(
      :name, :max_teams, :people_per_team,
      :race_datetime, :registration_open, :registration_close,
      :jsonform
    )
  end
end
