module DateHelper
  def human_readable(datetime)
    datetime.strftime "%B %e, %Y #{I18n.t('at')} %l:%M %p"
  end

  def human_readable_short(datetime)
    datetime.strftime "%b %e, %l:%M %p"
  end
end
