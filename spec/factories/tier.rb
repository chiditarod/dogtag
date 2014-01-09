FactoryGirl.define do
  factory :tier do

    begin_at (Time.now - 2.weeks)
    price 50.00

    factory :tier2 do
      price 60.00
      begin_at (Time.now - 1.second)
    end

    factory :tier3 do
      price 70.00
      begin_at (Time.now + 2.weeks)
    end
  end

end
