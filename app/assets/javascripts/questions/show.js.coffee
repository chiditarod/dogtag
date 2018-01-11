$(".questions.show").ready ->
  questions = $.parseJSON($('#questions').attr('data-questions'))

  onSubmit = onSubmitValid: (values) ->
    $(':submit').attr('disabled', true)

  customizeErrors = displayErrors: (errors, formElt) ->
    i = 0
    while i < errors.length
      if errors[i].message == 'String does not match pattern'
        errors[i].message = 'Invalid choice; please choose the correct answer'
      i++
    $(formElt).jsonFormErrors errors, formObject

  formObject = $.extend(questions, onSubmit, customizeErrors)

  $('form#questions').jsonForm(formObject)
