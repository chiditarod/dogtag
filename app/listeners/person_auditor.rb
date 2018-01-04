class PersonAuditor
  def create_person_successful(person)
    refresh(person.team)
  end

  def destroy_person_successful(person)
    refresh(person.team)
  end

  private

  def refresh(team)
    team.reload
    team.finalize || team.unfinalize
  end
end
