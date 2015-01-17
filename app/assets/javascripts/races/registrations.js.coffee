$(".races.registrations").ready ->
  # ------------------------------------------------------------------------
  # TableSorter Stuff

  # extend the bootstrap tablesorter theme
  # see: http://mottie.github.io/tablesorter/docs/example-widget-bootstrap-theme.html
  $.extend $.tablesorter.themes.bootstrap,
    sortNone: "bootstrap-icon-unsorted"
    sortAsc: "icon-chevron-up glyphicon glyphicon-chevron-up" # includes classes for Bootstrap v2 & v3
    sortDesc: "icon-chevron-down glyphicon glyphicon-chevron-down" # includes classes for Bootstrap v2 & v3

  $(".team_sort").tablesorter(
    theme: 'bootstrap'
    headerTemplate: '{content} {icon}'
    widgets: [ "uitheme", "filter" ]
    widthFixed: true
    headers:
      0:
        sorter: false
  )

  # ------------------------------------------------------------------------
  # Column Title Popovers

  popover_options =
    placement: 'bottom'
    trigger: 'hover'
    delay:
      show: 500
      hide: 1000
    html: true
  $('[id^=popover-]').popover(popover_options)
