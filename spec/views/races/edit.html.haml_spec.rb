require "spec_helper"

describe "races/edit", type: :view do
  let(:race) { FactoryBot.create(:race) }
  let(:new_requirement_link) { "a[href='#{new_race_requirement_url(race)}']" }

  def render_as(user)
    assign(:race, race)
    allow(controller).to receive(:current_ability).and_return(Ability.new(user))
    render
  end

  it "shows operators the link to add a requirement" do
    render_as(FactoryBot.create(:operator_user))
    expect(Nokogiri::HTML(rendered).at_css(new_requirement_link)).to be_present
  end

  it "shows admins the link to add a requirement" do
    render_as(FactoryBot.create(:admin_user))
    expect(Nokogiri::HTML(rendered).at_css(new_requirement_link)).to be_present
  end

  it "hides the link from a plain user" do
    render_as(FactoryBot.create(:user))
    expect(Nokogiri::HTML(rendered).at_css(new_requirement_link)).to be_nil
  end
end
