$(".races.registrations").ready ->
  # ------------------------------------------------------------------------
  # TableSorter Stuff

  # extend the bootstrap tablesorter theme
  # see: http://mottie.github.io/tablesorter/docs/example-widget-bootstrap-theme.html
  $.extend $.tablesorter.themes.bootstrap,
    sortNone: "bootstrap-icon-unsorted"
    sortAsc: "icon-chevron-up glyphicon glyphicon-chevron-up" # includes classes for Bootstrap v2 & v3
    sortDesc: "icon-chevron-down glyphicon glyphicon-chevron-down" # includes classes for Bootstrap v2 & v3

  $finalized = $(".team_sort#finalized").tablesorter(
    headerTemplate: '{content} {icon}'
    widgets: ["zebra", "filter"],
    widgetOptions:
      filter_columnFilters: false,
      filter_saveFilters : true,
      filter_reset: '.reset_finalized'
    widthFixed: true
    headers:
      0:
        sorter: false
  )

  $.tablesorter.filter.bindSearch( $finalized, $('.search_finalized') );

  #todo: this can be DRY'd up into a function

  $waitlisted = $(".team_sort#waitlisted").tablesorter(
    headerTemplate: '{content} {icon}'
    widgets: ["zebra", "filter"],
    widgetOptions:
      filter_columnFilters: false,
      filter_saveFilters : true,
      filter_reset: '.reset_waitlisted'
    widthFixed: true
    headers:
      0:
        sorter: false
  )

  $.tablesorter.filter.bindSearch( $waitlisted, $('.search_waitlisted') );
