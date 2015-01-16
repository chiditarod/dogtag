$(".users.index").ready ->
  # ------------------------------------------------------------------------
  # TableSorter Stuff

  # extend the bootstrap tablesorter theme
  # see: http://mottie.github.io/tablesorter/docs/example-widget-bootstrap-theme.html
  $.extend $.tablesorter.themes.bootstrap,
    sortNone: "bootstrap-icon-unsorted"
    sortAsc: "icon-chevron-up glyphicon glyphicon-chevron-up" # includes classes for Bootstrap v2 & v3
    sortDesc: "icon-chevron-down glyphicon glyphicon-chevron-down" # includes classes for Bootstrap v2 & v3

  # custom sort function to handle checkboxes (inside spans) as well as numerical entries
  #matrixFilterFunction = (node) ->
    #if node.contains("span") then node.children("span").attr("alt") else node.innerHTML

  $("#users").tablesorter(
    theme: 'bootstrap'
    headerTemplate: '{content} {icon}'
    widgets: [ "uitheme", "filter" ]
    widthFixed: true
    #textExtraction: matrixFilterFunction
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
