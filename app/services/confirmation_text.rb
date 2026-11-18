# Renders a race's Markdown confirmation text to safe HTML. Shared by the API
# and the confirmation email.
module ConfirmationText
  ALLOWED_TAGS = %w[p br strong em a ul ol li h3 h4 code blockquote].freeze
  ALLOWED_ATTRIBUTES = %w[href].freeze

  def self.to_html(source)
    return if source.blank?

    html = Commonmarker.to_html(
      source,
      options: { render: { unsafe: false, hardbreaks: true }, extension: { header_ids: nil } },
      plugins: { syntax_highlighter: nil }
    )
    ActionController::Base.helpers.sanitize(html, tags: ALLOWED_TAGS, attributes: ALLOWED_ATTRIBUTES)
  end
end
