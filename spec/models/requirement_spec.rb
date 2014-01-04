describe Requirement do
  describe '#fulfilled?' do
    it "raises an error since it's an abstract base class" do
      req = FactoryGirl.create :requirement
      expect { req.fulfilled?() }.to raise_error 'Implement me!'
    end
  end
end
