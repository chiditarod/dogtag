# Copyright (C) 2017 Devin Breen
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

class MyCoolWorker
  include Sidekiq::Worker
  include Workers::Common

  sidekiq_options queue: :foo
end

# The jid (job id) is always nil during tests, for some reason.
describe Workers::Common do

  describe "#perform" do

    let(:worker) { MyCoolWorker.new }
    let(:job)    {{ some: :thing }}
    let(:log)    {{ job: job }}

    it 'marshals the job' do
      marshaled = Marshal.dump(job)
      expect(Marshal).to receive(:dump).with(job).and_return(marshaled)
      expect(worker).to receive(:run).with(job, log)
      worker.perform(job)
    end

    it "logs 'received' and calls run" do
      expect(worker).to receive(:log).with("received", log)
      expect(worker).to receive(:run).with(job, log)
      worker.perform(job)
    end

    context 'when original_job is nil' do
      let(:job) { nil }
      let(:log) {{ job: {} }}
      it "logs _received and calls run" do
        expect(worker).to receive(:log).with("received", log)
        expect(worker).to receive(:run).with({}, log)
        worker.perform(job)
      end
    end

    context 'on error' do
      let(:worker) { MyCoolWorker.new }

      errors = [StandardError, EOFError, SystemCallError, SocketError]
      errors.each do |error|
        it "for #{error}, logs useful information and reraises error to let sidekiq manage the retries" do
          my_error = error.new("testing plumbing")
          expect(worker).to receive(:log).with("received", {job: job})
          expect(worker).to receive(:run).and_raise(my_error)
          expect(worker).to receive(:log).with("error", {}, :error, my_error)
          expect do
            worker.perform(job)
          end.to raise_error(my_error)
        end
      end
    end
  end

  describe "#run" do
    let(:worker) { MyCoolWorker.new }
    it "raises a descriptive error" do
      expect { worker.run }.to raise_error(RuntimeError)
    end
  end

  describe "#log" do
    let(:worker) { MyCoolWorker.new }
    let(:data)   {{ some: :thing }}
    let(:log) {{
      message: "foo",
      jid: nil,
      data: data
    }}

    context "only event is passed" do
      let(:data)   {{}}
      it "logs basic stuff" do
        expect(Rails.logger).to receive(:send).with(:info, log)
        worker.log('foo')
      end
    end

    context "when only event and data are provided" do

      it "defaults to level 'info'" do
        expect(Rails.logger).to receive(:send).with(:info, log)
        worker.log('foo', data)
      end
    end

    context "when log level is customized" do
      it "passes them along" do
        expect(Rails.logger).to receive(:send).with(:error, log)
        worker.log('foo', data, :error)
      end
    end

    context "when log level is customized and exception is passed" do
      let(:exception) { StandardError.new("omg!") }
      let(:ex_hash) {{
        klass: exception.class,
        message: exception.message,
        backtrace: exception.backtrace
      }}

      it "passes them along" do
        expect(Rails.logger).to receive(:send).with(:error, log.merge({error: ex_hash}))
        worker.log('foo', data, :error, exception)
      end
    end
  end
end
