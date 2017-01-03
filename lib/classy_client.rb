class ClassyClient

  attr_reader :access_token, :token_type, :expires_at

  API_HOST        = "https://api.classy.org"
  API_VERSION     = "2.0"
  DEFAULT_TIMEOUT = 3 # seconds
  AUTH_ENDPOINT   = "#{API_HOST}/oauth2/auth"
  BASE_HEADERS    = { 'User-Agent' => 'dogtag' }
  API_HEADERS     = BASE_HEADERS.merge({ 'Content-type' => 'application/json' })

  def initialize
    fetch_access_token!
  end

  def get_campaign(id)
    get("/campaigns/#{id}")
  end

  # todo: before creating the user, see if they already exist
  # https://developers.classy.org/api-docs/v2/index.html#member-member-get
  #
  def get_member(id_or_email)
    get("/members/#{id_or_email}")
  end

  def create_member(campaign_id, first, last, email)
    # only the required things
    body = {
      "first_name" => first,
      "last_name" => last,
      "email_address" => email,
      "date_of_birth" => "",
      "gender" => ""
    }
    post("/organizations/#{campaign_id}/members", body)
  end

  def create_fundraising_team(campaign_id, name, description, team_lead_id, goal)
    # only the required things
    body = {
      "name" => name,
      "description" => description,
      "team_lead_id" => team_lead_id,
      "team_captain_id" => team_lead_id,
      "goal" => goal
    }
    post("/campaigns/#{campaign_id}/fundraising-teams", body)
  end

  def update_fundraising_team(team_id, body)
    put("/fundraising-teams/{team_id}", body)
  end

  def create_fundraising_page(team_id, member_id, title, goal)
    body = {
      "member_id" => member_id,
      "title" => title,
      "goal" => goal
    }
    post("/fundraising-teams/#{team_id}/fundraising-pages", body)
  end

  private

  def fetch_access_token!
    unless ENV['CLASSY_CLIENT_ID'] && ENV['CLASSY_CLIENT_SECRET']
      raise ArgumentError, "Must provide 'CLASSY_CLIENT_ID' and 'CLASSY_CLIENT_SECRET' environment variables to use Classy"
    end

    credentials = {
      'grant_type'    => 'client_credentials',
      'client_id'     => ENV['CLASSY_CLIENT_ID'],
      'client_secret' => ENV['CLASSY_CLIENT_SECRET']
    }

    client = HTTPClient.new
    client.connect_timeout = DEFAULT_TIMEOUT
    response = wrapper(:post, "/oauth2/auth", { body: credentials })

    @access_token = response['access_token']
    @token_type = response['token_type']
    @expires_at = Time.now + response['expires_in'].seconds
  end

  def token_expired?
    Time.now > @expires_at
  end

  def with_token
    fetch_access_token! if token_expired?
    args = { header: API_HEADERS }
    args[:header]['Authorization'] = "#{@token_type} #{@access_token}"
    yield(args)
  end

  def get(uri, query={})
    with_token do |args|
      args[:query] = query if query
      wrapper(:get, "/#{API_VERSION}#{uri}", args)
    end
  end

  def post(uri, body=nil)
    with_token do |args|
      args[:body] = body.to_json if body
      wrapper(:post, "/#{API_VERSION}#{uri}", args)
    end
  end

  def put(uri, body={})
    with_token do |args|
      args[:body] = body if body
      wrapper(:put, "/#{API_VERSION}#{uri}", args)
    end
  end

  # docs for httpclient gem: http://www.rubydoc.info/gems/httpclient/HTTPClient
  # for get, specify query in args, e.g.
  #   query: { 'foo' => 'bar', 'baz' => 'omg' }
  # for post, specify a body in args
  #
  # args - args to pass to http_client
  def wrapper(verb, uri, args={})
    args[:header] = {} unless args[:header].present?
    args[:header]['User-Agent'] = 'dogtag'
    args[:follow_redirect] = true

    http = HTTPClient.new
    http.connect_timeout = DEFAULT_TIMEOUT
    response = http.send(verb, "#{API_HOST}#{uri}", args)

    unless response.ok?
      raise TransientError.new("#{response.status}: #{response.body}")
    end

    JSON.parse(response.body)
    # res.status
    # res.contenttype
    # res.header['X-Custom']
  end
end
