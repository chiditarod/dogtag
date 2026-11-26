require "spec_helper"

describe Users::StaffSearch do
  def ids(search) = search.users.map(&:id)

  let!(:ada) { FactoryBot.create(:user, first_name: "Ada", last_name: "Racer", email: "ada@example.com") }
  let!(:bea) { FactoryBot.create(:user, first_name: "Bea", last_name: "Racer", email: "bea@example.com") }
  let!(:zed) { FactoryBot.create(:user, first_name: "Zed", last_name: "Aardvark", email: "zed@example.com") }

  it "orders by last name, then first name" do
    expect(ids(described_class.new)).to eq([zed.id, ada.id, bea.id])
  end

  it "matches every word against name, email or team name" do
    expect(ids(described_class.new(q: "ada racer"))).to eq([ada.id])
    expect(ids(described_class.new(q: "BEA@example"))).to eq([bea.id])

    FactoryBot.create(:team, user: ada, name: "Doge Sled")
    expect(ids(described_class.new(q: "ada doge"))).to eq([ada.id])
    expect(ids(described_class.new(q: "bea doge"))).to eq([])
  end

  it "finds nothing for text that matches no one" do
    expect(described_class.new(q: "zzz").users).to eq([])
  end

  it "escapes LIKE wildcards" do
    expect(described_class.new(q: "100%").users).to eq([])
    expect(described_class.new(q: "a_a").users).to eq([])
  end

  it "pages 35 at a time" do
    FactoryBot.create_list(:user, 33)
    first = described_class.new
    expect(first.users.size).to eq(35)
    expect(first.meta).to eq(page: 1, per_page: 35, total_count: 36, total_pages: 2)

    second = described_class.new(page: "2")
    expect(second.users.size).to eq(1)
    expect(second.meta[:page]).to eq(2)
  end

  it "treats a junk or out-of-range page as page 1 or the clamp" do
    expect(described_class.new(page: "junk").meta[:page]).to eq(1)
    expect(described_class.new(page: "0").meta[:page]).to eq(1)
    expect(described_class.new(page: "99999999").meta[:page]).to eq(described_class::MAX_PAGE)
  end
end
