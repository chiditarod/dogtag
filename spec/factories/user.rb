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
FactoryBot.define do

  factory :user do
    sequence(:first_name) { |n| "First#{n}" }
    sequence(:last_name)  { |n| "Last#{n}" }
    sequence(:email)      { |n| "email#{n}@fake.com" }

    phone { '312-867-5309' }
    password { '12345678' }
    password_confirmation { '12345678' }

    factory :admin_user do
      roles { [:admin] }
    end

    factory :operator_user do
      roles { [:operator] }
    end

    factory :refunder_user do
      roles { [:refunder] }
    end

    factory :user2 do
      first_name { 'Mr' }
      last_name { 'Anderson' }
      email { 'mr@anderson.com' }
    end

    trait :with_classy_id do
      classy_id { 123456 }
    end

    trait :with_stripe_account do
      sequence(:stripe_customer_id) { |n| "stripe_customer_#{n}" }
    end
  end
end
