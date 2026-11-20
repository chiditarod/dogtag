require "spec_helper"

describe "API v1 captain", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:race) { FactoryBot.create(:race) }
  let!(:team) { FactoryBot.create(:team, user: user, race: race) }
  let!(:ada) { FactoryBot.create(:person, team: team) }
  let!(:bo) { FactoryBot.create(:person, team: team) }

  before { api_login(user) }

  def choose(person_id, team_id: team.id)
    put "/api/v1/teams/#{team_id}/captain", params: { person_id: person_id }, as: :json
  end

  it "sets the captain and returns the team" do
    choose(bo.id)

    expect(response).to have_http_status(:ok)
    expect(json["team"]["captain_id"]).to eq(bo.id)
    expect(json["team"]["checklist"]["racers"]).to include("captain" => true, "done" => true)
    expect(team.reload.captain_id).to eq(bo.id)
  end

  it "moves the captain to another racer and clears the inferred flag" do
    team.update_columns(captain_id: ada.id, captain_inferred: true)

    choose(bo.id)

    expect(team.reload.captain_id).to eq(bo.id)
    expect(team.captain_inferred).to be_nil
  end

  it "rejects a racer from another team" do
    stranger = FactoryBot.create(:person, team: FactoryBot.create(:team, race: race))

    choose(stranger.id)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json["errors"]["person_id"]).to be_present
    expect(team.reload.captain_id).to be_nil
  end

  it "rejects a missing person_id" do
    put "/api/v1/teams/#{team.id}/captain", params: {}, as: :json
    expect(response).to have_http_status(:bad_request)
  end

  it "finalizes a team that is otherwise complete as soon as its captain is chosen" do
    expect { choose(ada.id) }.to change { team.reload.finalized }.from(nil).to(true)
    expect(json["team"]["checklist"]["finalized"]).to be(true)
  end

  it "does not finalize a team that still has unanswered questions" do
    questions_team = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race_with_jsonform))
    racer = FactoryBot.create(:person, team: questions_team)
    FactoryBot.create(:person, team: questions_team)

    choose(racer.id, team_id: questions_team.id)

    expect(response).to have_http_status(:ok)
    expect(questions_team.reload.finalized).to be_nil
  end

  it "is refused once registration has closed" do
    late = FactoryBot.create(:team, user: user, race: race)
    person = FactoryBot.create(:person, team: late)
    race.update_columns(registration_close: 2.days.ago, final_edits_close: 1.day.ago)

    choose(person.id, team_id: late.id)

    expect(response).to have_http_status(:forbidden)
    expect(late.reload.captain_id).to be_nil
  end

  it "lets staff re-assign after registration closed" do
    late = FactoryBot.create(:team, race: race)
    person = FactoryBot.create(:person, team: late)
    race.update_columns(registration_close: 2.days.ago, final_edits_close: 1.day.ago)
    api_login(FactoryBot.create(:admin_user))

    choose(person.id, team_id: late.id)

    expect(response).to have_http_status(:ok)
    expect(late.reload.captain_id).to eq(person.id)
  end

  it "refuses another user's team" do
    api_login(FactoryBot.create(:user))
    choose(ada.id)
    expect(response).to have_http_status(:forbidden)
    expect(team.reload.captain_id).to be_nil
  end

  it "requires a login" do
    delete "/api/v1/session", as: :json
    choose(ada.id)
    expect(response).to have_http_status(:unauthorized)
  end
end
