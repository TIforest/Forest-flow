-- Additive migration: historical profiles, task ownership and history stay intact.
CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)));
INSERT INTO workspaces VALUES('ti','Tecnologia da Informação',1);
ALTER TABLE users ADD COLUMN access_status TEXT NOT NULL DEFAULT 'pending' CHECK(access_status IN('pending','active','blocked','merged'));
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN(0,1));
CREATE TABLE corporate_identities(
 tenant_id TEXT NOT NULL,object_id TEXT NOT NULL,user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 email TEXT NOT NULL,display_name TEXT NOT NULL,PRIMARY KEY(tenant_id,object_id)
);
CREATE TABLE workspace_memberships(
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN('member','coordinator')),PRIMARY KEY(workspace_id,user_id)
);
INSERT INTO workspace_memberships SELECT 'ti',id,role FROM users;
-- SQLite cannot add a non-null REFERENCES default to a populated table.
ALTER TABLE tasks ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);
UPDATE tasks SET workspace_id='ti';
CREATE TRIGGER tasks_workspace_required_insert BEFORE INSERT ON tasks WHEN NEW.workspace_id IS NULL BEGIN SELECT RAISE(ABORT,'workspace required'); END;
CREATE TRIGGER tasks_workspace_required_update BEFORE UPDATE OF workspace_id ON tasks WHEN NEW.workspace_id IS NULL BEGIN SELECT RAISE(ABORT,'workspace required'); END;
CREATE INDEX tasks_workspace ON tasks(workspace_id,deleted_at);
CREATE TABLE corporate_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL);
CREATE TABLE oauth_transactions(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
-- Invalidate all old shared and individual sessions. Old password tables are retained for rollback only.
DELETE FROM team_sessions;
DELETE FROM sessions;
