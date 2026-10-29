-- Sector-specific information must not overwrite a person's corporate profile.
CREATE TABLE workspace_member_profiles (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  job TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (workspace_id,user_id),
  FOREIGN KEY (workspace_id,user_id) REFERENCES workspace_memberships(workspace_id,user_id) ON DELETE CASCADE
);
