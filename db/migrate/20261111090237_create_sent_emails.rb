class CreateSentEmails < ActiveRecord::Migration[8.0]
  def change
    create_table :sent_emails do |t|
      t.text :mailer
      t.text :action
      t.text :recipient
      t.text :subject
      t.bigint :user_id
      t.bigint :team_id
      t.bigint :race_id
      t.text :kind
      t.text :dedupe_key
      t.text :message_id
      t.text :status, default: "queued"
      t.text :error
      t.datetime :status_changed_at

      t.timestamps
    end

    add_index :sent_emails, :team_id
    add_index :sent_emails, :status
    add_index :sent_emails, :message_id
    add_index :sent_emails, [:team_id, :kind, :dedupe_key],
      unique: true,
      where: "dedupe_key IS NOT NULL",
      name: "index_sent_emails_on_team_kind_dedupe_key"
  end
end
