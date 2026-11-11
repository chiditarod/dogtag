class AddExperienceLabelsToRaces < ActiveRecord::Migration[8.0]
  # Literal copy of the original Team::EXPERIENCE_LEVELS so this migration
  # does not depend on application constants.
  LEGACY_LABELS = [
    "Zero. Fresh meat",
    "1st year veterans",
    "2nd year sophmorons",
    "3rd year's a charm",
    "4th year senioritis",
    "5th year repeat offenders",
    "6th year and we're still drunk",
    "7th years of good luck",
    "8th year elite",
    "9th year elders",
    "10th year anniversary",
    "11th year OGs",
    "12th year sages",
    "13th year fingers crossed",
    "14th year clumsy adolescents",
    "15th year student drivers",
    "Sweet 16th",
    "17th year.. wait, what?",
    "18th year I'M AN ADULT",
    "19th year wait are you seriously still doing this?",
    "XX",
    "21st year finally legal"
  ].freeze

  def up
    add_column :races, :experience_labels, :text, array: true, default: [], null: false

    quoted = LEGACY_LABELS.map { |label| connection.quote(label) }.join(", ")
    execute "UPDATE races SET experience_labels = ARRAY[#{quoted}]::text[]"
  end

  def down
    remove_column :races, :experience_labels
  end
end
