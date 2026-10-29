-- Sanitized login diagnostics: no emails, tokens, authorization codes or secrets.
CREATE TABLE auth_login_failures (
 id TEXT PRIMARY KEY,
 stage TEXT NOT NULL,
 error_code TEXT NOT NULL,
 provider_code TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
