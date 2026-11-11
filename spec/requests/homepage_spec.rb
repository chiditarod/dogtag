require "spec_helper"

describe "Homepage get started link", type: :request do
  it "links to the legacy races list by default" do
    get "/"
    expect(response.body).to include(%(href="#{races_url}"))
  end

  it "links to /register when REGISTRATION_UI is spa" do
    stub_const("ENV", ENV.to_h.merge("REGISTRATION_UI" => "spa"))
    get "/"
    expect(response.body).to include('href="/register"')
    expect(response.body).not_to include(%(href="#{races_url}"))
  end
end
