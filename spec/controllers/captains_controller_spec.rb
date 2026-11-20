require "spec_helper"

describe CaptainsController do
  let(:team) { FactoryBot.create(:team, :with_people, people_count: 2) }
  let(:person) { team.people.last }

  context "[logged out]" do
    it "redirects to login" do
      put :update, params: { team_id: team.id, person_id: person.id }
      expect(response).to redirect_to(new_user_session_path)
    end
  end

  context "[logged in as the owner]" do
    before do
      activate_authlogic
      login_user! team.user
    end

    it "makes the racer captain, clears the inferred flag and redirects to the team" do
      team.update_column(:captain_inferred, true)

      put :update, params: { team_id: team.id, person_id: person.id }

      expect(team.reload.captain_id).to eq(person.id)
      expect(team.captain_inferred).to be_nil
      expect(response).to redirect_to(team_url(id: team.id))
    end

    it "finalizes a team that is otherwise complete" do
      expect { put :update, params: { team_id: team.id, person_id: person.id } }
        .to change { team.reload.finalized }.from(nil).to(true)
    end

    it "refuses a racer from another team" do
      stranger = FactoryBot.create(:person, team: FactoryBot.create(:team))

      put :update, params: { team_id: team.id, person_id: stranger.id }

      expect(team.reload.captain_id).to be_nil
      expect(flash[:error]).to eq(I18n.t("captains.update.not_on_team"))
    end

    it "is forbidden in the final edit window, when racer details are still editable" do
      late = FactoryBot.create(:team, :with_people, people_count: 1, user: team.user)
      late.race.update_columns(registration_close: 1.day.ago, final_edits_close: 1.day.from_now)

      expect { put :update, params: { team_id: late.id, person_id: late.people.first.id } }
        .to raise_error(CanCan::AccessDenied)
      expect(late.reload.captain_id).to be_nil
    end

    it "is forbidden once registration and the final edit window are over" do
      late = FactoryBot.create(:team, :with_people, people_count: 1, user: team.user)
      late.race.update_columns(registration_close: 2.days.ago, final_edits_close: 1.day.ago)

      expect { put :update, params: { team_id: late.id, person_id: late.people.first.id } }
        .to raise_error(CanCan::AccessDenied)
      expect(late.reload.captain_id).to be_nil
    end
  end

  context "[logged in as an operator]" do
    before do
      activate_authlogic
      login_user! FactoryBot.create(:operator_user)
    end

    it "changes the captain after registration has closed" do
      team.race.update_columns(registration_close: 2.days.ago, final_edits_close: 1.day.ago)

      put :update, params: { team_id: team.id, person_id: person.id }

      expect(team.reload.captain_id).to eq(person.id)
      expect(response).to redirect_to(team_url(id: team.id))
    end
  end

  context "[logged in as another user]" do
    before do
      activate_authlogic
      login_user! FactoryBot.create(:user)
    end

    it "does not change the captain" do
      expect { put :update, params: { team_id: team.id, person_id: person.id } }
        .to raise_error(CanCan::AccessDenied)
      expect(team.reload.captain_id).to be_nil
    end
  end
end
