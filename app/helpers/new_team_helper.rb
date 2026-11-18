# Staff-only display of Team#new_team. Admin text, so not translated.
module NewTeamHelper
  def new_team_label(team)
    label = yes_no_unknown(team.new_team)
    team.new_team_overridden ? "#{label} (set by admin)" : label
  end

  def new_team_setting_options(team)
    [["Automatic (now #{yes_no_unknown(team.computed_new_team)})", "auto"], ["Yes", "yes"], ["No", "no"]]
  end

  private

  def yes_no_unknown(flag)
    { true => "Yes", false => "No" }.fetch(flag, "No racers yet")
  end
end
