require "spec_helper"

describe Workers::RegistrationReminders do
  let(:worker) { Workers::RegistrationReminders.new }
  let(:deliveries) { ActionMailer::Base.deliveries }
  let(:race) { FactoryBot.create(:race, registration_close: Time.zone.now + 23.hours) }
  let!(:team) { FactoryBot.create(:team, race: race) }

  it "sends once, sends nothing on second run" do
    worker.run({})
    expect(deliveries.count).to eq(1)
    expect(deliveries.first.to).to eq([team.user.email])
    expect(SentEmail.where(team_id: team.id, kind: "registration_reminder", dedupe_key: "close-24h").count).to eq(1)

    worker.run({})
    expect(deliveries.count).to eq(1)
  end

  it "keeps going when one reminder fails" do
    other = FactoryBot.create(:team, race: race)
    calls = 0
    allow(UserMailer).to receive(:registration_reminder).and_wrap_original do |original, *args|
      calls += 1
      raise StandardError, "boom" if calls == 1
      original.call(*args)
    end

    expect { worker.run({}) }.not_to raise_error
    expect(calls).to eq(2)
    expect(deliveries.count).to eq(1)
  end
end
