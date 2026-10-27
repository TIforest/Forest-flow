ALTER TABLE accounts ADD COLUMN email_verified_at TEXT;
UPDATE accounts SET email_verified_at = CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN registration_email TEXT COLLATE NOCASE;
CREATE UNIQUE INDEX users_registration_email ON users(registration_email);
UPDATE users SET registration_email=(SELECT email FROM accounts WHERE accounts.user_id=users.id);
UPDATE users SET registration_email='eduardo.silva@forest.ind.br' WHERE id='coord' AND registration_email IS NULL;
CREATE TABLE registrations (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 name TEXT NOT NULL, job TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL,
 sent_at INTEGER NOT NULL DEFAULT 0, consumed_at TEXT
);
CREATE TABLE email_preview (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, url TEXT NOT NULL, created_at INTEGER NOT NULL
);
