require 'spec_helper'

describe Person do
  let (:valid_person) { FactoryGirl.attributes_for :person }

  describe 'validates' do
    it 'success with all required parameters' do
      Person.create(valid_person).valid?.should be_true
    end

    it 'email address is valid' do
      Person.create(valid_person.merge({:email => 'bad@email'})).valid?.should be_false
      Person.create(valid_person.merge({:email => 'bad@email.'})).valid?.should be_false
      Person.create(valid_person.merge({:email => 'bademail.com'})).valid?.should be_false
      Person.create(valid_person.merge({:email => '@bademail.com'})).valid?.should be_false
      Person.create(valid_person.merge({:email => 'bad@email.a'})).valid?.should be_false
    end
  end
end


