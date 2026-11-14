class AddTimeZoneToRaces < ActiveRecord::Migration[8.0]
  def change
    add_column :races, :time_zone, :text, null: false, default: "America/Chicago"
  end
end
