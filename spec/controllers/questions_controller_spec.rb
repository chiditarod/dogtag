require 'spec_helper'

describe QuestionsController do

  context '[logged out]' do
    shared_examples 'redirects to login' do
      it 'redirects to login' do
        endpoint.call
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    describe '#create' do
      let(:endpoint) { lambda { post :create, team_id: 1 }}
      include_examples 'redirects to login'
    end
    describe '#show' do
      let(:endpoint) { lambda { get :show, id: 1, team_id: 1 }}
      include_examples 'redirects to login'
    end
  end

  context '[logged in]' do

    let (:valid_user) { FactoryGirl.create :admin_user }
    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#create' do
      let(:race) { FactoryGirl.create :race_with_jsonform }
      let(:team) { FactoryGirl.create :team, race: race }

      let(:thedata) {{
        'team_id' => team.id,
        'racer-type' => 'Racer'
      }}

      context 'when team is not found' do
        it 'renders 404' do
          post :create, team_id: team.id + 1
          expect(response.status).to eq(404)
        end
      end

      context 'when race is not open for registration' do
        let(:race) { FactoryGirl.create :race_with_jsonform, :registration_closed }

        it 'sets a flash info and redirects to team path' do
          post :create, team_id: team.id
          expect(flash[:error]).to eq(I18n.t('questions.cannot_modify'))
          expect(response.status).to redirect_to(team_path(team))
        end
      end

      {
        'is not on the whitelist' => { 'foo' => 'bar' },
        'has a blank value' => { 'primary-inspiration' => '' }
      }.each do |situation, bad_param|

        context "when a parameter #{situation}" do
          it 'rejects the invalid params' do
            post :create, thedata.merge!(bad_param)
            expect(team.reload.jsonform).to eq({'racer-type' => 'Racer'}.to_json)
          end
        end
      end

      context 'if team save operation fails' do
        let(:thedata) {{
          'team_id' => team.id,
          'racer-type' => 'Racer'
        }}

        before do
          expect(Team).to receive(:find).and_return(team)
          expect(team).to receive(:save).and_return(false)
        end

        it 'logs an error, sets a flash error, and redirects to team questions path' do
          expect(Rails.logger).to receive(:error)
          post :create, thedata
          expect(flash[:error]).to eq(I18n.t('questions.could_not_save'))
          expect(response.status).to redirect_to(team_questions_path(team))
        end
      end

      context 'if team save operation succeeds' do
        let(:thedata) {{
          'team_id' => team.id,
          'racer-type' => 'Racer'
        }}

        it 'sets a flash info and redirects to team path' do
          post :create, thedata
          expect(flash[:info]).to eq(I18n.t('questions.updated'))
          expect(response.status).to redirect_to(team_path(team))
        end
      end
    end

    describe '#show' do
      let(:team) { FactoryGirl.create :team, race: race }

      context 'the team is not found' do
        let(:race) { FactoryGirl.create :race }
        before do
          get :show, team_id: team.id + 1
        end

        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'race has no jsonform data' do
        let(:race) { FactoryGirl.create :race }
        before do
          get :show, team_id: team.id
        end

        it 'sets flash info' do
          expect(flash[:info]).to eq(I18n.t('questions.none_defined'))
        end
        it 'redirects to team#show' do
          expect(response).to redirect_to(team_path(team))
        end
      end

      context 'race has jsonform data' do
        let(:race) { FactoryGirl.create :race_with_jsonform }

        before do
          allow(controller).to receive(:form_authenticity_token).and_return('fake_token')
          get :show, team_id: team.id
        end

        let(:json) { JSON.parse(assigns(:questions)) }

        let(:expected_schema) {{
          "type" => "string",
          "default" => 'fake_token'
        }}
        let(:expected_form) {{
          "type" => "hidden",
          "key" => 'authenticity_token'
        }}

        it 'sets the appropriate csrf data onto the jsonform' do
          expect(json['schema']['properties']['authenticity_token']).to eq(expected_schema)
          expect(json['form'].detect{|item| item['key'] == 'authenticity_token'}).to eq(expected_form)
        end

        it 'renders 200' do
          expect(response.status).to eq(200)
        end

        context 'team has saved answers already' do
          let(:team) { FactoryGirl.create :team_with_jsonform, race: race }
          let(:auth_hash) {{ 'authenticity_token' => 'fake_token' }}

          it "merges the saved answers into the 'value' key and includes the authenticity_token" do
            expect(json['value']).to eq(JSON.parse(team.jsonform).merge(auth_hash))
          end

          it 'renders 200' do
            expect(response.status).to eq(200)
          end
        end
      end
    end
  end
end
