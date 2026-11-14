require "spec_helper"

describe "Homepage get started link", type: :request do
  let(:spa_built) { true }

  before do
    stub_const("ENV", ENV.to_h.except("REGISTRATION_UI", "VITE_DEV_SERVER"))
    allow(File).to receive(:exist?).and_call_original
    allow(File).to receive(:exist?).with(SpaController.index_path).and_return(spa_built)
  end

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

  context "when REGISTRATION_UI is spa but the SPA is not built" do
    let(:spa_built) { false }

    it "links to the legacy races list" do
      stub_const("ENV", ENV.to_h.merge("REGISTRATION_UI" => "spa"))
      get "/"
      expect(response.body).to include(%(href="#{races_url}"))
      expect(response.body).not_to include('href="/register"')
    end
  end
end
