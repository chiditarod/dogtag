# Copyright (C) 2014 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
class ChargesController < ApplicationController
  before_action :require_user
  before_action :require_stripe_params, only: [:create]
  before_action :require_charge_object, only: [:refund]
  before_action :require_prior_url

  STRIPE_PARAMS = %i{amount stripeToken stripeEmail description metadata}

  def create
    authorize! :create, :charges

    # the amount is never taken from the client; Payments::ChargeTeam derives it from the requirement's active tier
    metadata = JSON.parse params[:metadata]
    team = Team.find(metadata["team_id"])
    authorize! :edit, team
    requirement = Requirement.find(metadata["requirement_id"])

    result = Payments::ChargeTeam.call(
      user: current_user,
      team: team,
      requirement: requirement,
      stripe_token: params[:stripeToken],
      stripe_email: params[:stripeEmail]
    )

    if result.ok
      flash[:notice] = "Your card has been charged successfully."
    else
      flash[:error] = result.message
    end
    redirect_to session.delete(:prior_url)

  rescue CanCan::AccessDenied
    raise
  rescue => e
    flash[:error] = I18n.t("charges.unexpected")
    log_and_redirect(e)
  end

  def refund
    authorize! :refund, :charges
    Rails.logger.info "Refund requested for charge: #{params[:charge_id]}"

    StripeHelper.safely_call_stripe do
      @charge = @charge.refund
    end

    # TODO: re-evaluate if we want to render 500 here.
    unless @charge.refunded
      str = "Charge ID: #{@charge.id} could not be refunded. No action taken."
      Rails.logger.error(str)
      return render status: :internal_server_error, json: {error: str}
    end

    CompletedRequirement.mark_refunded_by_charge(@charge.id)

    msg = "The refund has processed successfully"

    if params.fetch(:delete_completed_requirement, false)
      if current_user.is?(:admin)
        CompletedRequirement.delete_by_charge(@charge)
        msg = "#{msg}, and the completed requirement was deleted"
      else
        msg = "#{msg}, but the completed requirement was not deleted because you do not have the appropriate permissions"
      end
    end

    flash[:notice] = msg
    url = session.delete(:prior_url)
    redirect_to(url)
  end

  private

  def log_and_redirect(ex)
    StripeHelper.log_and_return_error(ex)
    url = session.delete :prior_url
    redirect_to url
  end

  # require that session[:prior_url] exists. this allows this controller's methods
  # to know where to redirect the agent once the method completes.
  def require_prior_url
    unless session[:prior_url]
      render(
        status: :bad_request,
        json: {
          errors: "The calling controller should set session[:prior_url] so this method knows where to return to. e.g. session[:prior_url] = request.original_url"
        }
      )
    end
  end

  def require_stripe_params
    inquiry = params.require(STRIPE_PARAMS)
  rescue ActionController::ParameterMissing => e
    # Rails 7.0: Strip "Did you mean?" suggestions from error message
    error_message = e.message.split("\n").first
    render(
      status: :bad_request,
      json: {
        errors: error_message
      }
    )
  end

  def require_charge_object
    success, ex = StripeHelper.safely_call_stripe do
      @charge = Stripe::Charge.retrieve(params[:charge_id])
    end

    return render status: :not_found, json: {error: ex.message} unless success
    return render status: :bad_request, json: {error: "Charge ID #{@charge.id} is already refunded"} if @charge.refunded
  end
end
