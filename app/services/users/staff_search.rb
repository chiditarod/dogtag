# The staff users list: every user, searched and paged on the server.
#
# - q: case-insensitive words, each of which must match a user's first name, last name or email, or the
#   name of one of their teams. A blank q lists everyone.
module Users
  class StaffSearch
    PER_PAGE = 35
    # A page past this is clamped, so a huge page number cannot overflow the OFFSET.
    MAX_PAGE = 10_000

    SEARCH_SQL = <<~SQL.squish.freeze
      (users.first_name ILIKE :word OR users.last_name ILIKE :word OR users.email ILIKE :word
        OR EXISTS (SELECT 1 FROM teams WHERE teams.user_id = users.id AND teams.name ILIKE :word))
    SQL

    def initialize(q: nil, page: nil)
      @words = q.to_s.split
      @page = (Integer(page.to_s, 10, exception: false) || 1).clamp(1, MAX_PAGE)
    end

    # The page of users, with their teams and races preloaded (no per-row queries).
    def users
      @users ||= filtered.reorder(:last_name, :first_name, :id)
        .includes(teams: :race)
        .limit(PER_PAGE).offset((page - 1) * PER_PAGE).to_a
    end

    def meta
      { page: page, per_page: PER_PAGE, total_count: total_count, total_pages: (total_count / PER_PAGE.to_f).ceil }
    end

    private

    attr_reader :page, :words

    def filtered
      words.reduce(User.all) do |scope, word|
        scope.where(SEARCH_SQL, word: "%#{ActiveRecord::Base.sanitize_sql_like(word)}%")
      end
    end

    # User's default_scope orders by last_name, which a bare COUNT cannot take.
    def total_count
      @total_count ||= filtered.unscope(:order).count
    end
  end
end
