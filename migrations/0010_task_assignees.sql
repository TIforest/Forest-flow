-- Integrantes adicionais da atividade; o principal permanece em tasks.assignee_id.
-- IF NOT EXISTS: a tabela já foi criada em alguns bancos por uma versão anterior desta migração.
CREATE TABLE IF NOT EXISTS task_assignees (
 task_id TEXT NOT NULL REFERENCES tasks(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_assignees_user ON task_assignees(user_id);
