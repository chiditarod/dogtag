# Copyright (C) 2013 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
class RaceValidator < ActiveModel::Validator

  def validate(record)
    validate_dates(record) if datetimes_parse?(record)
    validate_jsonform(record)
  end

  private

  def validate_jsonform(record)
    return unless record.jsonform.present?
    begin
      validate_show_when(record, JSON.parse(record.jsonform))
    rescue JSON::ParserError => ex
      record.errors.add(:jsonform, ex.message)
    end
  end

  # A field that can be hidden must not be required. The SPA validates the
  # visible answers against both the per-property "required": true and the
  # top-level "required" array, and TeamValidator enforces the top-level array
  # on the whole schema whatever the SPA shows, so a hidden required field
  # would leave the racer unable to save.
  def validate_show_when(record, jsonform)
    return unless jsonform.is_a?(Hash) && jsonform["schema"].is_a?(Hash)
    schema = jsonform["schema"]
    properties = schema["properties"]
    return unless properties.is_a?(Hash) && jsonform["form"].is_a?(Array)
    required_list = schema["required"].is_a?(Array) ? schema["required"] : []

    each_form_item(jsonform["form"]) do |item|
      key = item["key"]
      next unless item.key?("showWhen")
      required = (properties[key].is_a?(Hash) && properties[key]["required"] == true) || required_list.include?(key)
      record.errors.add(:jsonform, "field \"#{key}\" is required, so it cannot have showWhen") if required
    end
  end

  def each_form_item(items, &block)
    items.each do |item|
      next unless item.is_a?(Hash)
      yield item
      each_form_item(item["items"], &block) if item["items"].is_a?(Array)
    end
  end

  def validate_dates(record)
    unless record.final_edits_close < record.race_datetime
      record.errors.add(:final_edits_close, 'must come before race_datetime')
    end
    unless record.registration_close < record.final_edits_close
      record.errors.add(:registration_close, 'must come before final_edits_close')
    end
    unless record.registration_open < record.registration_close
      record.errors.add(:registration_open, 'must come before registration_close')
    end
  end

  def datetimes_parse?(record)
    dates = [:race_datetime, :registration_open, :registration_close]
    dates.each do |d|
      begin
        DateTime.parse(record.__send__(d).to_s)
      rescue ArgumentError
        record.errors.add(d, 'must be a valid datetime')
      end
    end
    record.errors.count == 0
  end
end
