json.user do
  json.partial! "api/v1/staff/users/staff_user", user: @user
end
