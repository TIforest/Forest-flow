ALTER TABLE tasks ADD COLUMN title_key TEXT;
-- Keys for old records are populated by backfill-task-title-keys.mjs.
-- A deleted task releases its name; a completed task continues to reserve it.
CREATE UNIQUE INDEX tasks_unique_title ON tasks(workspace_id,title_key) WHERE deleted_at IS NULL AND title_key IS NOT NULL;
