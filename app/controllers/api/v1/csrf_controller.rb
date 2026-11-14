class Api::V1::CsrfController < Api::V1::BaseController
  def show
    render json: { token: form_authenticity_token }
  end
end
