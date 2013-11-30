module DateHelper
  def human_readable(datetime)
    datetime.strftime "%B %e, %Y #{I18n.t('at')} %l:%M %p"
  end
end
