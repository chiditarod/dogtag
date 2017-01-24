class ClassyUser

  # associate dogtag user account with an existing classy user, or tell classy to make a new
  # association and send an invite to the classy platform to the user
  def self.link_user_to_classy!(user, race)

    return user if user.classy_id.present?

    cc = ClassyClient.new

    begin
      result = cc.get_member(user.email)
      user.classy_id = result['id']
      user.save!
      user
    rescue TransientError # e.g. catch get_member non-200
      campaign_data = cc.get_campaign(race.classy_campaign_id)
      organization_id = campaign_data['organization_id']

      result = cc.create_member(organization_id, user.first_name, user.last_name, user.email)
      user.classy_id = result['id']
      user.save!
      user
    end
  end
end
