# A team's pick of another team in the same race to be placed near at the start.
class TeamBuddy < ApplicationRecord
  belongs_to :team
  belongs_to :buddy_team, class_name: "Team"

  validates :buddy_team_id, uniqueness: { scope: :team_id }
  validate :buddy_is_another_team_in_the_same_race

  private

  def buddy_is_another_team_in_the_same_race
    return if team.blank? || buddy_team.blank?

    if team == buddy_team
      errors.add(:buddy_team, "can't be your own team")
    elsif team.race_id != buddy_team.race_id
      errors.add(:buddy_team, "must be in the same race")
    end
  end
end
