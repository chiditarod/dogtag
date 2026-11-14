class Api::V1::PeopleController < Api::V1::BaseController
  before_action :require_api_user!
  before_action :load_team

  def create
    authorize!(:create, Person)
    authorize_update!(@team, @team)
    @person = @team.people.build(params.expect(person: person_attributes))
    @person.subscribe(PersonAuditor.new)

    if @person.save
      render_person_and_checklist(:created)
    else
      render_errors(@person)
    end
  end

  def update
    @person = @team.people.find(params[:id])
    authorize_update!(@person, @team)
    @person.subscribe(PersonAuditor.new)

    if @person.update(params.expect(person: person_attributes))
      render_person_and_checklist(:ok)
    else
      render_errors(@person)
    end
  end

  # Racers have no destroy rule in Ability; owners may remove one while registration
  # is open (the Team update rule), unless the team is already complete.
  def destroy
    authorize_update!(@team, @team)
    @person = @team.people.find(params[:id])
    return render_errors(I18n.t("people.destroy.team_complete")) if @team.meets_finalization_requirements?

    @person.subscribe(PersonAuditor.new)
    @person.destroy!
    @team.reload
    @checklist = TeamChecklist.new(@team).to_h
    render :destroy
  end

  private

  def person_attributes
    [:first_name, :last_name, :email, :phone, :zipcode, :experience, :twitter]
  end

  # Only the team's owner (or staff allowed to see it) may reach its people.
  def load_team
    @team = Team.find(params[:team_id])
    authorize!(:show, @team)
  end

  # Listeners may finalize the team, so reload before building the checklist.
  def render_person_and_checklist(status)
    @team.reload
    @checklist = TeamChecklist.new(@team).to_h
    render :show, status: status
  end
end
