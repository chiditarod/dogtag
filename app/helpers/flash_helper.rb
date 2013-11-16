module FlashHelper

  def flash_to_bootstrap(level)
    case level
      when :info then "success"
      when :notice then "info"
      when :error then "danger"
      when :alert then "warning"
    end
  end

end
