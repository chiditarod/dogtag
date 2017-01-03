require 'spec_helper'

describe ClassyClient do

  before do
    Timecop.freeze(THE_TIME)
    ENV['CLASSY_CLIENT_ID'] = 'some_id'
    ENV['CLASSY_CLIENT_SECRET'] = 'some_secret'
  end

  after { Timecop.return }

  shared_examples "authentication is successful" do
    let(:valid_auth_response) do
      {
        'access_token' => '123abc',
        'token_type' => 'bearer',
        'expires_in' => 3600
      }.to_json
    end

    before do
      stub_request(:post, ClassyClient::AUTH_ENDPOINT).to_return(status: 200, body: valid_auth_response)
    end
  end

  describe '#initialize' do

    %w(CLASSY_CLIENT_ID CLASSY_CLIENT_SECRET).each do |env_var|

      context "when class environment variable #{env_var} is not provided" do
        before do
          ENV[env_var] = nil
        end

        it "raises an error" do
          expect do
            ClassyClient.new
          end.to raise_error(ArgumentError)
        end
      end
    end

    context "when authentication succeeds" do
      include_examples "authentication is successful"

      it 'sets up the classy api authentication and sets the token expiry' do
        cc = ClassyClient.new
        expect(cc.access_token).to eq('123abc')
        expect(cc.token_type).to eq('bearer')
        expect(cc.expires_at).to eq(THE_TIME + 3600.seconds)
      end
    end
  end

  %i(get post put).each do |verb|

    describe "##{verb}" do

      include_examples "authentication is successful"
      let(:classy_url) { "#{ClassyClient::API_HOST}/#{ClassyClient::API_VERSION}" }

      context "when response is not 'ok'" do
        before do
          stub_request(verb, "#{classy_url}/foo").to_return(status: 404)
        end

        it "raises a TransientError" do
          expect do
            ClassyClient.new.send(verb, "/foo")
          end.to raise_error(TransientError)
        end
      end

      # this test will be very similar for the other verbs.  DRY it up
      context "when authentication token has expired" do
        let(:future)     { 3601 }
        let(:new_expiry) { THE_TIME + future.seconds + 3600.seconds }

        it "re-authenticates and updates the expiry`" do
          cc = ClassyClient.new
          Timecop.travel(future) do
            stub_request(verb, "#{classy_url}/foo").to_return(status: 200, body: {'foo' => 'bar'}.to_json)
            cc.send(verb, "/foo")
            # there is probably a cleaner way to do this
            expect(cc.expires_at.to_i).to eq(new_expiry.to_i)
          end
        end
      end
    end
  end
end
