CREATE TABLE tasks_v2 (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 assignee_id TEXT NOT NULL REFERENCES users(id),
 created_by TEXT NOT NULL REFERENCES users(id),
 week TEXT NOT NULL,
 due_date TEXT,
 priority TEXT NOT NULL CHECK(priority IN ('normal','high')),
 status TEXT NOT NULL DEFAULT 'progress' CHECK(status IN ('progress','blocked','done')),
 restricted INTEGER NOT NULL DEFAULT 0,
 block_reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT
);
INSERT INTO tasks_v2 SELECT id,title,description,assignee_id,created_by,
 date(week, '-' || strftime('%w',week) || ' days'),due_date,priority,
 CASE WHEN status='pending' THEN 'progress' ELSE status END,
 restricted,block_reason,created_at,completed_at FROM tasks;
CREATE TABLE events_v2 (
 id TEXT PRIMARY KEY,
 task_id TEXT NOT NULL REFERENCES tasks_v2(id),
 actor_id TEXT NOT NULL REFERENCES users(id),
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO events_v2 SELECT id,task_id,actor_id,replace(message,'Status: pending','Status: progress'),created_at FROM events;
DROP TABLE events;
DROP TABLE tasks;
ALTER TABLE tasks_v2 RENAME TO tasks;
ALTER TABLE events_v2 RENAME TO events;
CREATE INDEX tasks_week ON tasks(week);
