require 'spec_helper'

describe Person do

  describe 'validation' do
    it 'success with all required parameters' do
      expect(FactoryGirl.build(:person).valid?).to eq(true)
    end

    it 'fails on bad email address' do
      expect(FactoryGirl.build(:person, :email => 'bad@email').valid?).to eq(false)
      expect(FactoryGirl.build(:person, :email => 'bad@email.').valid?).to eq(false)
      expect(FactoryGirl.build(:person, :email => 'bademail.com').valid?).to eq(false)
      expect(FactoryGirl.build(:person, :email => '@bademail.com').valid?).to eq(false)
      expect(FactoryGirl.build(:person, :email => 'bad@email.a').valid?).to eq(false)
    end

    it 'requires twitter to start with an @ sign' do
      expect(FactoryGirl.build(:person, :twitter => 'bad').valid?).to eq(false)
      expect(FactoryGirl.build(:person, :twitter => '@good').valid?).to eq(true)
    end
  end
end


