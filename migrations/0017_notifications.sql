CREATE TABLE notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
 workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, read_at TEXT
);
CREATE INDEX notifications_recipient ON notifications(user_id,created_at DESC);
CREATE TABLE push_subscriptions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, session_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notification_deliveries (
 notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 attempts INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(notification_id,subscription_id)
);
CREATE INDEX push_subscription_recipient ON push_subscriptions(user_id);
