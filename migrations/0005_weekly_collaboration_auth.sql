CREATE TABLE task_weeks (
 task_id TEXT NOT NULL REFERENCES tasks(id), week TEXT NOT NULL,
 added_by TEXT NOT NULL REFERENCES users(id), added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(task_id,week)
);
INSERT INTO task_weeks(task_id,week,added_by) SELECT id,week,created_by FROM tasks;
CREATE INDEX task_weeks_week ON task_weeks(week);
CREATE TABLE comments (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
 author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX comments_task ON comments(task_id);
CREATE TABLE accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id), email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 salt TEXT NOT NULL, password_hash TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE INDEX session_user ON sessions(user_id);
CREATE TABLE invites (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), email TEXT NOT NULL COLLATE NOCASE, expires_at INTEGER NOT NULL
);
CREATE TABLE auth_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
