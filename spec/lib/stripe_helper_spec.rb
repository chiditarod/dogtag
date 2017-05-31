# Copyright (C) 2016 Devin Breen
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
require 'spec_helper'

describe StripeHelper do

  describe "#safely_call_stripe" do

    it "yields control" do
      expect { |b| StripeHelper.safely_call_stripe(&b) }.to yield_with_no_args
    end

    context "error conditions" do

      shared_examples "rescues, logs, returns" do
        before do
          expect(Rails.logger).to receive(:error).with(expected)
        end

        it "rescues, logs the exception, and returns false w/ exception" do
          expect(StripeHelper.safely_call_stripe { raise error }).to eq([false, error])
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

      let(:error_msg) { 'some message' }

      context "Stripe::InvalidRequestError" do
        let(:error)    { Stripe::InvalidRequestError.new(error_msg, "some_param") }
        let(:expected) { {class: error.class.to_s, reason: error_msg}.to_json }
        include_examples "rescues, logs, returns"
      end

      context "Stripe::AuthenticationError" do
        let(:error)    { Stripe::AuthenticationError.new(error_msg) }
        let(:expected) { {class: error.class.to_s, reason: error_msg}.to_json }
        include_examples "rescues, logs, returns"
      end

      context "Stripe::APIConnectionError" do
        let(:error)    { Stripe::APIConnectionError.new(error_msg) }
        let(:expected) { {class: error.class.to_s, reason: error_msg}.to_json }
        include_examples "rescues, logs, returns"
      end

      context "Stripe::StripeError" do
        let(:error)    { Stripe::StripeError.new(error_msg) }
        let(:expected) { {class: error.class.to_s, reason: error_msg}.to_json }
        include_examples "rescues, logs, returns"
      end

      #TODO: change to StandardError?
      context "Any other exception" do
        let(:error)    { StandardError.new(error_msg) }
        let(:expected) { {class: error.class.to_s, reason: error_msg}.to_json }
        include_examples "rescues, logs, returns"
      end
    end
  end

  describe "#exception_to_hash" do
    let(:mock_exception) { double(StandardError, message: "omg!", http_status: nil, json_body: nil) }

    let(:thehash) {{
      class: mock_exception.class.to_s,
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
          class: mock_exception.class.to_s,
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
        class: mock_exception.class.to_s,
        reason: mock_exception.message,
        http_status: 200
      }}

      it "includes the http status" do
        expect(StripeHelper.exception_to_hash(mock_exception)).to eq(thehash)
      end
    end
  end
end
