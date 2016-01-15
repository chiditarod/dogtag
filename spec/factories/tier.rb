FactoryGirl.define do
  factory :tier do
    ignore do
      thetime { Timecop.freeze(THE_TIME) { Time.now } }
    end

    price 5000
    begin_at { thetime - 2.weeks }

    factory :tier2 do
      price 6000
      begin_at { thetime - 2.days }
    end

    factory :tier3 do
      price 7000
      begin_at { thetime + 2.weeks }
    end
  end
end
