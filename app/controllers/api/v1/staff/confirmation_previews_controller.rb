# Renders a race's confirmation text exactly as racers will see it, for the staff race form.
class Api::V1::Staff::ConfirmationPreviewsController < Api::V1::Staff::BaseController
  before_action { authorize!(:update, Race) }

  def create
    # Blank is a valid draft (the form's field starts empty), so a missing text is not an error.
    text = params[:text].to_s
    if text.length > Race::CONFIRMATION_TEXT_MAX_LENGTH
      message = "is too long (maximum is #{Race::CONFIRMATION_TEXT_MAX_LENGTH} characters)"
      return render json: { error: "invalid", errors: { text: [message] } }, status: :unprocessable_entity
    end

    render json: { html: ConfirmationText.to_html(text) }
  end
end
