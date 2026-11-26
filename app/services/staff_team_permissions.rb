# What a viewer may do on a team page, computed once on the server so the SPA never guesses from
# roles. Built on the existing Ability and the same rules the controllers enforce.
class StaffTeamPermissions
  # Admins and operators may set the "new team" flag (TeamsController#team_params).
  def self.new_team_setter?(user) = user.is_any_of?(:admin, :operator)

  # Racers answer the questions while registration is open; admins and operators any time.
  def self.questions_open?(team, user)
    team.race.open_for_registration? || user.is_any_of?(:admin, :operator)
  end

  def initialize(team, user)
    @team = team
    @user = user
    @race = team.race
    @ability = Ability.new(user)
  end

  def to_h
    {
      update_team: update_team?,
      set_captain: update_team?,
      add_racers: people_window? && ability.can?(:create, Person) && update_team?,
      edit_racers: people_window? && ability.can?(:update, Person.new(team: team)),
      remove_racers: update_team?,
      edit_questions: race.jsonform.present? && self.class.questions_open?(team, user) && ability.can?(:edit, team),
      delete_team: ability.can?(:destroy, team) && team.completed_requirements.none?,
      take_payment: Payments::ChargeTeam.staff_payer?(user) && ability.can?(:edit, team),
      set_new_team: self.class.new_team_setter?(user),
      view_emails: ability.can?(:index, SentEmail),
      view_payments: ability.can?(:refund, :charges)
    }
  end

  private

  attr_reader :team, :user, :race, :ability

  def update_team? = ability.can?(:update, team)

  def people_window? = race.open_for_registration? || race.in_final_edits_window?
end
