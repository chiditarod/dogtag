# Calculate total race time for each time in a CSV file. Sorts the results by fastest time.
# Outputs to stdout.
#
# Here is the input I got from Brian.
# The input from ChiScore is bad, the AM/PMs are incorrect.
# The input *should* arrive in 24 hour format w/ UTC offset, and the first data point should be the race start.
#
# Sample actual data from ChiScore 2016:
#
# name,1,2,3,4,5,6
# 3GS&T 10th Ed,12:45:37 PM,01:39:34 AM,02:25:00 AM,03:22:51 AM,04:13:28 AM,05:13:25 AM
# "Beetlejuice, Beetlejuice, Beetlejuice!!!",12:52:30 PM,01:48:22 AM,02:39:57 AM,03:45:43 AM,04:35:57 AM,--
# ChiDADarod,12:44:08 PM,01:49:21 AM,02:32:43 AM,03:25:16 AM,--,--
# Dr. Onesie,--,--,--,--,--,--
# Grandma's Birthday,12:46:56 PM,01:42:10 AM,02:23:24 AM,03:10:19 AM,04:21:48 AM,04:47:54 AM
# Mile High Mushers,12:48:10 PM,01:43:23 AM,02:45:36 AM,03:40:48 AM,04:27:38 AM,05:26:15 AM
# Rub a Dub Dub 5 Girls in a Tub,12:46:49 PM,01:32:07 AM,02:21:52 AM,03:10:53 AM,04:23:10 AM,04:50:55 AM
# Spaced Out,12:46:45 PM,01:39:54 AM,02:30:35 AM,03:28:12 AM,--,--
# Steves Jobs,12:49:44 PM,01:45:24 AM,--,--,--,--

require 'csv'

CHISCORE_DATA = 'results.csv'
ALLOW_MISSING_CHECKPOINTS = true
REQUIRED_LEGS = 6
# :html, :csv
OUTPUT = :html
# whether to include AM/PM in output
TERSER = true

# hack - we should get the race time as the first column in the csv
RACE_START = Time.strptime("12:30:09 PM UTC", "%I:%M:%S %p %Z")

namespace :chiscore do

  task :import => [:environment] do
    with_totals = CSV.foreach(CHISCORE_DATA).map do |row|
      # hack to fix the busted AM/PM in the input. There is no AM
      row.map! { |cell| cell.gsub(/ AM$/," PM") rescue cell }

      add_total_for(row)
    end.sort_by { |row| row.last }

    output(with_totals)
  end

  private

  def add_total_for(row)
    first_time = nil
    last_time = nil
    legs = 0

    row.each_with_index do |cell, i|
      begin
        time = Time.strptime(cell + " UTC", "%I:%M:%S %p %Z")
        #first_time ||= time # this is what we want
        first_time = RACE_START # hack for now
        last_time = time
        legs = legs + 1
        # strip off the AM/PM from the end
        if TERSER
          row[i] = time.strftime("%l:%M:%S")
        end
      rescue
        # this keeps the tally running as long as it's not the
        # last leg (e.g. reaching the finish line)
        if ALLOW_MISSING_CHECKPOINTS && cell == "--" && i != REQUIRED_LEGS
          legs = legs + 1
        end
      end
    end

    if (legs == REQUIRED_LEGS)
      total = Time.at(last_time - first_time).utc.strftime("%H:%M:%S")
    else
      total = "Incomplete"
    end

    row.push(total)
  end

  def output(data)
    case OUTPUT
    when :csv
      data.each do |row|
        # quote the name in the first column
        row[0] = "\"#{row[0]}\""
        puts row.join(",")
      end
    when :html
      data.each do |row|
        puts "<tr><td>" + row.join("</td><td>") + "</td></tr>"
      end
    end
  end
end
