require "spec_helper"

# The racer pages' locale keys are gone (the SPA carries its own copy in frontend/src/locales/en.ts).
# These keys look like legacy page copy but are read by the API, services, mailers or the kept staff pages.
describe "Kept locale keys" do
  def expect_keys(keys)
    missing = keys.reject { |key| I18n.exists?(key, :en) }
    expect(missing).to eq([])
  end

  it "keeps every key the API, services and mailers read" do
    expect_keys(%w[
      charges.unexpected charges.stripe_error charges.invalid_request charges.api_connection
      charges.price_changed charges.mock_declined charges.mock_not_saved charges.roster_incomplete
      charges.race_full charges.already_paid charges.in_progress charges.duplicate_charge
      charges.not_payable charges.wrong_race charges.no_active_price charges.unable_to_get_customer
      teams.destroy.has_payments people.destroy.team_complete
      api.errors.registration_closed api.errors.invalid_buddies api.errors.buddies_need_collaborating
      api.errors.person_not_on_team api.errors.current_password_incorrect api.errors.reset_login_failed
      at logout_success users.review_your_info global_questions
      user_mailer.registration_reminder.heading user_mailer.email_changed_email.subject
      user_mailer.payment_refunded_email.subject
    ])
  end

  it "keeps the root keys the kept requirement and tier tables read" do
    expect_keys(%w[name enabled details price begin_at action_required edit delete save back])
  end

  it "keeps the keys the kept staff pages, controllers and navbar read" do
    expect_keys(%w[
      website_title mush admin
      create_success create_failed update_success update_failed delete_success destroy_failed
      application.navbar.races application.navbar.users application.navbar.emails application.navbar.payments
      application.navbar.my_teams application.navbar.admin_functions application.navbar.login
      users.index.users users.index.search
      races.update.time_zone_changed races.edit.race_requirements races.destroy.delete_success
      races.form.manage_race races.form.time_zone races.form.confirmation_text_help
      requirements.table.tiers requirements.new.new_requirement requirements.edit.edit_requirement
      requirements.form.name requirements.form.type requirements.payment_requirement_table.payment_tiers
      tiers.new.new_tier tiers.edit.edit_tier tiers.form.price tiers.form.begin_at_instructions
    ])
  end

  it "keeps the model error messages" do
    expect_keys(%w[
      activerecord.errors.models.person.attributes.email.taken_on_team
      activerecord.errors.models.team.attributes.captain.not_on_team
      activerecord.errors.models.race.attributes.confirmation_text.too_long_text
    ])
  end
end
