$(".questions.show").ready ->
  questions = $.parseJSON($('#questions').attr('data-questions'))

  onSubmit = onSubmitValid: (values) ->
    $(':submit').attr('disabled', true)

  $('form#questions').jsonForm($.extend(questions, onSubmit))
