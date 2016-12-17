require 'spec_helper'

describe StripeHelper do

  describe "#safely_call_stripe" do

    it "yields control" do
      expect { |b| StripeHelper.safely_call_stripe(&b) }.to yield_with_no_args
    end

    context "error conditions" do

      shared_examples "rescues and logs" do
        before do
          expect(Rails.logger).to receive(:error).with(expected)
        end
        it "rescues and logs the exception" do
          StripeHelper.safely_call_stripe { raise error }
        end
      end

      context "Stripe::CardError" do
        let(:error) { Stripe::CardError.new("some-message", "some-param", "some-code", 500) }

        it "logs basic exception data to rails logger" do
          expect(Rails.logger).to receive(:error).with(Stripe::CardError)
          expect(Rails.logger).to receive(:error).with("HTTP status: 500")
          StripeHelper.safely_call_stripe { raise error }
        end

        context "if json_body[:error] is included in Stripe::CardError" do
          let(:json_body) {{
            error: {
              type: 'some-type',
              code: 'some-code',
              param: 'some-param',
              message: 'some-message'
            }
          }}
          let(:error) { Stripe::CardError.new("some-message", "some-param", "some-code", 500, nil, json_body) }

          it "logs json_body data to rails logger" do
            expect(Rails.logger).to receive(:error).with(Stripe::CardError)
            expect(Rails.logger).to receive(:error).with("HTTP status: 500")
            expect(Rails.logger).to receive(:error).with("type: some-type")
            expect(Rails.logger).to receive(:error).with("code: some-code")
            expect(Rails.logger).to receive(:error).with("param: some-param")
            expect(Rails.logger).to receive(:error).with("message: some-message")
            StripeHelper.safely_call_stripe { raise error }
          end
        end
      end

      context "Stripe::InvalidRequestError" do
        let(:error)    { Stripe::InvalidRequestError.new("some message", "some_param") }
        let(:expected) { "#{error.class}" }
        include_examples "rescues and logs"
      end

      context "Stripe::AuthenticationError" do
        let(:error)    { Stripe::AuthenticationError }
        let(:expected) { error.to_s }
        include_examples "rescues and logs"
      end

      context "Stripe::APIConnectionError" do
        let(:error)    { Stripe::APIConnectionError }
        let(:expected) { error.to_s }
        include_examples "rescues and logs"
      end

      context "Stripe::StripeError" do
        let(:error)    { Stripe::StripeError }
        let(:expected) { error.to_s }
        include_examples "rescues and logs"
      end

      #TODO: change to StandardError?
      context "Any other exception" do
        let(:error)    { StandardError }
        let(:expected) { "#{error}: Non-Stripe Error" }
        include_examples "rescues and logs"
      end
    end
  end

  describe "#exception_to_hash" do
    let(:mock_exception) { double(StandardError, message: "omg!", http_status: nil, json_body: nil) }

    let(:thehash) {{
      reason: mock_exception.message
    }}

    it "returns a hash of the error message" do
      expect(StripeHelper.exception_to_hash(mock_exception)).to eq(thehash)
    end

    context "when there is a json payload in the exception" do
      let(:json_body) {{
        error: {
          type: 'some-type',
          code: 'some-code',
          param: 'some-param',
          message: 'some-message'
        }
      }}

      let(:mock_exception) { double(StandardError, message: "omg!", http_status: nil, json_body: json_body) }
      let(:thehash) do
        {
          reason: mock_exception.message
        }.merge!(json_body[:error])
      end

      it "includes the json payload" do
        expect(StripeHelper.exception_to_hash(mock_exception)).to eq(thehash)
      end
    end

    context "if exception has http status" do
      let(:mock_exception) { double(StandardError, message: "omg!", http_status: 200, json_body: nil) }
      let(:thehash) {{
        reason: mock_exception.message,
        http_status: 200
      }}

      it "includes the http status" do
        expect(StripeHelper.exception_to_hash(mock_exception)).to eq(thehash)
      end
    end
  end

  describe "#log_charge_error" do
    let(:thehash) {{
      a: 1,
      b: 2
    }}

    it "calls rails logger" do
      expect(StripeHelper).to receive(:exception_to_hash).and_return(thehash)
      expect(Rails.logger).to receive(:error).with(thehash.to_json)
      StripeHelper.log_charge_error(nil)
    end

    context "when an exception is raised" do
      it "logs the exception to rails logger" do
        expect(StripeHelper).to receive(:exception_to_hash).and_raise(StandardError, "omg!")
        expect(Rails.logger).to receive(:error).with("Error logging stripe error: omg!")
        StripeHelper.log_charge_error(nil)
      end
    end
  end
end
