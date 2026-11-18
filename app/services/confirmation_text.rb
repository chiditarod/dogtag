# Renders a race's Markdown confirmation text to safe HTML. Shared by the API
# and the confirmation email.
module ConfirmationText
  ALLOWED_TAGS = %w[p br strong em a ul ol li h3 h4 code blockquote].freeze
  ALLOWED_ATTRIBUTES = %w[href].freeze

  ALLOWED_PROTOCOLS = %w[http https mailto].freeze

  # Rails' sanitizer lets relative URLs, ftp, tel and webcal through; keep only
  # http, https and mailto, and leave the link text when the href goes.
  HREF_SCRUBBER = Class.new(Loofah::Scrubber) do
    def scrub(node)
      return unless node.name == "a" && node["href"]

      scheme = node["href"].strip.match(/\A([a-z][a-z0-9+.-]*):/i)&.captures&.first&.downcase
      node.remove_attribute("href") unless ALLOWED_PROTOCOLS.include?(scheme)
    end
  end.new.freeze

  def self.to_html(source)
    return if source.blank?

    html = Commonmarker.to_html(
      source,
      options: { render: { unsafe: false, hardbreaks: true }, extension: { header_ids: nil } },
      plugins: { syntax_highlighter: nil }
    )
    clean = ActionController::Base.helpers.sanitize(html, tags: ALLOWED_TAGS, attributes: ALLOWED_ATTRIBUTES)
    fragment = Loofah.html5_fragment(clean)
    fragment.scrub!(HREF_SCRUBBER)
    fragment.to_s.html_safe
  end
end
