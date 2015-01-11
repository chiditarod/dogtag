module ApplicationHelper

  def javascript_include_if_exists(script)
    javascript_include_tag(script) if javascript_exists?(script)
  end

  def javascript_exists?(script)
    script = "#{Rails.root}/app/assets/javascripts/#{script}"
    ['.coffee', '.js', '.js.coffee', ''].any? do |extension|
      File.file? "#{script}#{extension}"
    end
  end
end
