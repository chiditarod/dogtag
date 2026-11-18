class AddConfirmationToRacesAndTeams < ActiveRecord::Migration[8.0]
  DEFAULT_CONFIRMATION_TEXT = <<~MD.strip
    How about some fundraising? Fundraising for The CHIditarod Foundation funds grants to other Chicago nonprofits and shows off all the work your team puts into the race. Visit [chiditarod.org/fundraising](http://www.chiditarod.org/fundraising) to get started, and check out the [fundraising incentives](http://www.chiditarod.org/fundraising-incentives).

    More news is on the way. In the meantime, read up at [chiditarod.org](http://www.chiditarod.org/).
  MD

  def change
    add_column :races, :confirmation_text, :text
    add_column :teams, :confirmation_seen_at, :datetime

    reversible do |dir|
      dir.up do
        execute "UPDATE teams SET confirmation_seen_at = NOW() WHERE finalized = true"
        execute <<~SQL
          UPDATE races SET confirmation_text = #{connection.quote(DEFAULT_CONFIRMATION_TEXT)}
          WHERE race_datetime > NOW() AND confirmation_text IS NULL
        SQL
      end
    end
  end
end
