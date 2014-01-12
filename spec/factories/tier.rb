FactoryGirl.define do
  factory :tier do
    begin_at (Time.now - 2.weeks)
    price 5000

    factory :tier2 do
      price 6000
      begin_at (Time.now - 1.second)
    end

    factory :tier3 do
      price 7000
      begin_at (Time.now + 2.weeks)
    end
  end
end
