require "spec_helper"

RSpec.describe ConfirmationText do
  describe ".to_html" do
    it "renders paragraphs, emphasis and links" do
      html = described_class.to_html("Hi **there**\n\nRead [Start Here](https://example.com/start)")

      expect(html).to include("<p>Hi <strong>there</strong></p>")
      expect(html).to include('<a href="https://example.com/start">Start Here</a>')
      expect(html).to be_html_safe
    end

    it "renders lists" do
      expect(described_class.to_html("- one\n- two")).to include("<li>one</li>")
    end

    it "never passes raw HTML through" do
      ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>"].each do |source|
        html = described_class.to_html(source)
        expect(html).not_to include("<script")
        expect(html).not_to include("onerror")
      end
    end

    it "drops javascript: links" do
      expect(described_class.to_html("[x](javascript:alert(1))")).not_to include("javascript:")
    end

    it "keeps mailto links" do
      expect(described_class.to_html("[mail](mailto:dogtag@chiditarod.org)"))
        .to include('href="mailto:dogtag@chiditarod.org"')
    end

    it "keeps http and https links and drops the href for other schemes" do
      expect(described_class.to_html("[a](http://example.com)")).to include('href="http://example.com"')
      expect(described_class.to_html("[a](https://example.com)")).to include('href="https://example.com"')
      ["ftp://x.example.com", "tel:123", "/foo", "webcal://x.example.com/c.ics"].each do |url|
        html = described_class.to_html("[label](#{url})")
        expect(html).not_to include("href")
        expect(html).to include("label")
      end
    end

    it "is nil when blank" do
      expect(described_class.to_html(nil)).to be_nil
      expect(described_class.to_html("  \n")).to be_nil
    end
  end
end
