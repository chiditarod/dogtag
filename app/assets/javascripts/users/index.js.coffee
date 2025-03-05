$(".users.index").ready ->

  $('.select2-name').select2
    placeholder: 'Search by first or last name'
    ajax:
      url: $('.select2-name').data('url')
      dataType: 'json'
      delay: 500
      data: (params) ->
        q: params.term
        page: params.page || 1
      processResults: (data) ->
        results: data
      cache: true

  $('.select2-name').on 'select2:select', (e) ->
    userId = e.params.data.id
    $('#selected-user-id').val(userId)
    $('#search-form').attr('action', "/users/#{userId}")
    $('#search-form').submit()

  $('.select2-team').select2
    placeholder: 'Search by team name'
    ajax:
      url: $('.select2-team').data('url')
      dataType: 'json'
      delay: 500
      data: (params) ->
        q: params.term
        page: params.page || 1
      processResults: (data) ->
        results: data
      cache: true

  $('.select2-team').on 'select2:select', (e) ->
    teamId = e.params.data.id
    $('#selected-team-id').val(teamId)
    $('#search-form').attr('action', "/teams/#{teamId}")
    $('#search-form').submit()

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
    headerTemplate: '{content} {icon}'
    widgets: ["zebra", "filter"],
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
