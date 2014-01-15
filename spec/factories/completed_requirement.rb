FactoryGirl.define do
  factory :completed_requirement, aliases: [:cr] do
    requirement
    registration
    user
  end

  trait :with_metadata do
    ignore do
      hash {{ 'foo'=>'bar' }}
    end
    metadata { JSON.generate(hash) }
  end
end
