ALTER TABLE notifications ADD COLUMN reminder_date TEXT;
ALTER TABLE notifications ADD COLUMN reminder_due_date TEXT;
CREATE UNIQUE INDEX deadline_notification_daily ON notifications(user_id,task_id,reminder_date) WHERE reminder_date IS NOT NULL;
CREATE INDEX tasks_reminder_due ON tasks(due_date) WHERE deleted_at IS NULL AND status!='done';
