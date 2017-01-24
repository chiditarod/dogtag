require 'spec_helper'

describe Workers::ClassyCreateFundraisingPage do

  let(:worker) { Workers::ClassyCreateFundraisingPage.new }

  describe "#run" do

    context 'when team already has a classy fundraiser page id' do
      it 'logs complete and returns'
    end

    context 'when team has no classy id' do
      it 'logs op-op and returns'
    end

    context 'when user has no classy id' do
      it 'logs op-op and returns'
    end

    context 'when the fundraising page creation is unsuccessful' do
      it 'errors out'
    end

    context 'when the fundraising page creation is successful' do
      it 'saves the id to the team, saves the team, sends confirmation email, logs complete, and enqueues a ClassyCreateFundraisingPage job'
    end
  end
end


