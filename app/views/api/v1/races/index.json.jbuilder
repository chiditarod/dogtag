json.races @races do |race|
  json.partial! "api/v1/races/race", race: race
end
