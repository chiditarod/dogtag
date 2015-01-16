$(".questions.show").ready ->
  team_id = $('#questions').attr('data-team_id')
  questions = $.parseJSON($('#questions').attr('data-questions'))

  onSubmit = onSubmitValid: (values) ->
    $.ajax
      type: "POST"
      url: "/teams/" + team_id + "/questions"
      data:
        answers: values
        team_id: team_id
      success: ->
        window.location.replace('/teams/' + team_id)
      failure: ->
        window.alert("Could not save the questions")

  $('form#questions').jsonForm($.extend(questions, onSubmit))
