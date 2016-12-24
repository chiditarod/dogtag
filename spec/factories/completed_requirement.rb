FactoryGirl.define do
  factory :completed_requirement, aliases: [:cr] do
    requirement
    team
    user
  end

  trait :with_metadata do
    transient do
      hash {{
        'foo' => 'bar',
        'amount' => '7000'
      }}
    end
    metadata { JSON.generate(hash) }
  end
end
