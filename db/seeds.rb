# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)
#
user = User.create(first_name: "Admin", last_name: "User", phone: "123456", email: "admin@fake.com",
                   password: "12345678", password_confirmation: "12345678")

user.roles = [:admin]
user.save

user_ops = User.create(first_name: "Admin", last_name: "User", phone: "123456", email: "ops@fake.com",
                       password: "12345678", password_confirmation: "12345678")

user_ops.roles = [:admin]
user_ops.save
