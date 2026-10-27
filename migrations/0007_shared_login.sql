CREATE TABLE team_credentials (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 salt TEXT NOT NULL,
 password_hash TEXT NOT NULL
);
INSERT INTO team_credentials SELECT email,salt,password_hash FROM accounts WHERE email='ti@forest.ind.br';
CREATE TABLE team_sessions (
 token_hash TEXT PRIMARY KEY,
 profile_id TEXT REFERENCES users(id),
 expires_at INTEGER NOT NULL
);
