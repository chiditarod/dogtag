# Staff endpoints (refunder, operator, admin): 401 when logged out, 403 for racers.
class Api::V1::Staff::BaseController < Api::V1::BaseController
  before_action :require_api_user!
  before_action { authorize!(:refund, :charges) }
end
