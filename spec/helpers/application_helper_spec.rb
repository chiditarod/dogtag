require 'spec_helper'

describe ApplicationHelper, :type => :helper do

  describe "#javascript_include_if_exists" do
    before do
      Rails.stub(:root => "#{Rails.root}/spec/fixtures")
    end

    it "returns a script tag if the file exists" do
      expected_include_string = '<script src="/javascripts/sample/sample_coffee.js"></script>'
      javascript_include_if_exists('sample/sample_coffee').should == expected_include_string
    end

    it "returns nil if the file does not exist" do
      javascript_include_if_exists('missing').should == nil
    end
  end

  describe "#javascript_exists?" do
    before do
      Rails.stub(:root => "#{Rails.root}/spec/fixtures")
    end

    ['.coffee', '.js', '.js.coffee', ''].each do |extension|
      it "returns true if the file exists with the #{extension} extension" do
        sample_file = extension.gsub('.', '_')
        javascript_exists?("sample/sample#{sample_file}").should == true
      end
    end

    it "returns false if the file is actually a directory" do
      javascript_exists?('sample').should == false
    end

    it "returns false if the file doesn't exist" do
      javascript_exists?('foo').should == false
    end
  end
end
