FactoryGirl.define do
  factory :tier do

    begin_at 1.year.ago
    price 50.00

    factory :tier2 do
      price 60.00
      begin_at (1.year.ago + 2.weeks)
    end

    factory :tier3 do
      price 70.00
      begin_at (1.year.ago + 4.weeks)
    end

  end
end
