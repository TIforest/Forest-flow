-- Existing active accounts keep their access; pending and future accounts need review.
ALTER TABLE users ADD COLUMN onboarding_required INTEGER NOT NULL DEFAULT 1 CHECK(onboarding_required IN(0,1));
UPDATE users SET onboarding_required=0 WHERE access_status='active' OR is_admin=1;
CREATE TABLE access_requests (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 name TEXT NOT NULL,
 job TEXT NOT NULL,
 department TEXT NOT NULL,
 unit TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','approved','rejected')),
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,
 reviewed_by TEXT REFERENCES users(id),
 review_note TEXT NOT NULL DEFAULT '',
 decision_id TEXT
);
CREATE INDEX access_requests_status ON access_requests(status,submitted_at);
