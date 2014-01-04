## Generic model to be overridden
class Requirement < ActiveRecord::Base
  validates_presence_of :name

  def fulfilled?
    raise 'Implement me!'
  end
end
