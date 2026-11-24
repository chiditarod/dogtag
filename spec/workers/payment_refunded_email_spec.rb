require "spec_helper"

describe Workers::PaymentRefundedEmail do
  let(:team) { FactoryBot.create(:team) }
  let(:job) do
    {
      "user_id" => team.user.id, "team_id" => team.id, "completed_requirement_id" => 9,
      "requirement_name" => "Cart Deposit", "amount_cents" => 5000, "race_name" => team.race.name
    }
  end

  it "emails the team owner from plain job values, without needing the completed requirement" do
    expect { described_class.new.perform(job) }.to change { ActionMailer::Base.deliveries.count }.by(1)

    mail = ActionMailer::Base.deliveries.last
    expect(mail.to).to eq([team.user.email])
    expect(mail.body.encoded).to include("Cart Deposit", "$50.00")
  end

  it "sends once when the job runs twice" do
    2.times { described_class.new.perform(job) }

    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(SentEmail.where(kind: "refund", dedupe_key: "refund-cr-9").count).to eq(1)
  end
end
