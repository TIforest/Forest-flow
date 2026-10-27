ALTER TABLE users ADD COLUMN color TEXT NOT NULL DEFAULT '#2869bc';
UPDATE users SET color = '#7751b5' WHERE id = 'coord';
UPDATE users SET color = '#b35c27' WHERE id = 'ana';
UPDATE users SET color = '#008578' WHERE id = 'lucas';
