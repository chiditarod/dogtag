require 'spec_helper'

describe TeamsController do

  describe "GET 'mush'" do
    it "returns http success" do
      get 'mush'
      response.should be_success
    end
  end

end
