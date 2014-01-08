class PeopleController < ApplicationController
  before_filter :require_user

  def destroy
    @person = Person.find params[:id]
    return render :status => 400 if @person.nil?

    if @person.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t 'destroy_failed'
    end
    redirect_to race_registration_url :race_id => @person.registration.race.id, :id => @person.registration.id
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def update
    return render :status => 400 unless params[:person]
    @person = Person.find(params[:id])
    @registration = @person.registration
    @race = @registration.race

    if @person.update_attributes person_params
      flash[:notice] = I18n.t('update_success')
      redirect_to race_registration_url :race_id => @person.registration.race.id, :id => @person.registration.id
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @person.errors.messages
    end
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def edit
    @person = Person.find params[:id]
    @registration = @person.registration
    @race = @registration.race
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    return render :status => 400
  end

  def index
    @people = Person.where(:registration_id => params[:registration_id])
  end

  def new
    # we need these b/c they are referenced in _form.html.haml
    @race = Race.find params[:race_id]
    @registration = Registration.find params[:registration_id]

    @person = Person.new
  end

  def create
    return render :status => 400 if params[:person].blank?

    @registration = Registration.find params[:registration_id]
    @person = Person.new person_params
    @person.registration = @registration

    # we need these b/c they are referenced in _form.html.haml
    @race = Race.find params[:race_id]

    if @person.save
      flash[:notice] = I18n.t('create_success')
      redirect_to race_registration_url({:race_id => params[:race_id], :id => params[:registration_id]})
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @person.errors.messages
    end
  end

  private

  def person_params
    params.require(:person).permit(:first_name, :last_name, :email, :phone, :twitter)
  end
end
