-- Sessões expiram após 10 minutos sem atividade; last_seen_at guarda o último uso.
-- Sessões existentes recebem 0 e passam a exigir novo login.
ALTER TABLE team_sessions ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;
