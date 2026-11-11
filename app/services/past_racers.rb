# People a user has raced with before: everyone on teams the user captained
# (never anyone else's), excluding the current team's racers and placeholders.
class PastRacers
  PLACEHOLDER_EMAIL = /unknown/i

  def initialize(user:, team:)
    @user = user
    @team = team
  end

  def call
    people = Person.joins(:team).includes(team: :race)
      .where(teams: { user_id: @user.id })
      .where.not(team_id: @team.id)
      .order(updated_at: :desc)
      .to_a

    current_emails = @team.people.pluck(:email).map(&:downcase)
    people
      .reject { |person| person.email.match?(PLACEHOLDER_EMAIL) || current_emails.include?(person.email.downcase) }
      .uniq { |person| person.email.downcase }
  end
end
