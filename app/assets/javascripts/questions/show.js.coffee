$(".questions.show").ready ->
  questions = $.parseJSON($('#questions').attr('data-questions'))
  $('form#questions').jsonForm(questions)
