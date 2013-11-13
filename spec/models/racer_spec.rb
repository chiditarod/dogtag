require 'spec_helper'

describe Racer do

  let (:valid_racer) { JSON.parse File.read 'spec/fixtures/valid_racer.json' }

  describe 'validates' do
    it 'success with all required parameters' do
      Racer.create(valid_racer).valid?.should be_true
    end

    it 'email address is valid' do
      Racer.create(valid_racer.merge({:email => 'bad@email'})).valid?.should be_false
      Racer.create(valid_racer.merge({:email => 'bad@email.'})).valid?.should be_false
      Racer.create(valid_racer.merge({:email => 'bademail.com'})).valid?.should be_false
      Racer.create(valid_racer.merge({:email => '@bademail.com'})).valid?.should be_false
      Racer.create(valid_racer.merge({:email => 'bad@email.a'})).valid?.should be_false
    end
  end
end
