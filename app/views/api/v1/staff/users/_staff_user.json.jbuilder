json.extract! user, :id, :first_name, :last_name, :email, :phone
json.roles user.roles.map(&:to_s)
