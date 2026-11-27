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
  before_action :require_prior_url

  STRIPE_PARAMS = %i{amount stripeToken stripeEmail description metadata}

  def create
    authorize! :create, :charges

    # the amount is never taken from the client; Payments::ChargeTeam derives it from the requirement's active tier.
    # The posted amount is the price the Checkout popup showed, so a mismatch means the price changed meanwhile.
    metadata = JSON.parse params[:metadata]
    team = Team.find(metadata["team_id"])
    authorize! :edit, team
    requirement = Requirement.find(metadata["requirement_id"])

    result = Payments::ChargeTeam.call(
      user: current_user,
      team: team,
      requirement: requirement,
      stripe_token: params[:stripeToken],
      stripe_email: params[:stripeEmail],
      expected_amount_cents: params[:amount].to_i
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

    cr = CompletedRequirement.find_by(charge_id: params[:charge_id])
    return render status: :not_found, json: { error: "No payment found for charge #{params[:charge_id]}" } unless cr

    result = Payments::RefundCharge.call(user: current_user, completed_requirement: cr)
    if result.ok
      flash[:notice] = refund_notice(result, cr)
    else
      flash[:error] = result.message
    end
    redirect_to session.delete(:prior_url)
  end

  # Reopens a refunded payment so the team can pay again. Operators and admins only (see Ability).
  def reopen
    authorize! :reopen, :charges
    result = Payments::ReopenPayment.call(user: current_user, completed_requirement: CompletedRequirement.find(params[:id]))
    flash[result.ok ? :notice : :error] = result.message
    redirect_to session.delete(:prior_url)
  end

  private

  def log_and_redirect(ex)
    StripeHelper.log_and_return_error(ex)
    url = session.delete :prior_url
    redirect_to url
  end

  # The notice for a successful refund. An operator or admin may also reopen the payment ("refund and
  # reopen"), so the team can pay again. The row is kept, so the refund and the reopen stay on record.
  def refund_notice(result, cr)
    msg = result.message.chomp(".")
    return msg unless ActiveModel::Type::Boolean.new.cast(params[:reopen])
    return "#{msg}, but the payment was not reopened because you do not have the appropriate permissions" unless can?(:reopen, :charges)

    reopened = Payments::ReopenPayment.call(user: current_user, completed_requirement: cr)
    reopened.ok ? "#{msg}, and the payment was reopened" : "#{msg}, but the payment was not reopened: #{reopened.message}"
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
end
