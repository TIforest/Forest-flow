import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { taskTitleKey } from '../src/task-title.ts';
const remote = process.argv.includes('--remote');
const args = [
  'd1',
  'execute',
  'DB',
  remote ? '--remote' : '--local',
  '--config',
  remote ? 'deployment/wrangler.jsonc' : 'wrangler.jsonc',
];
const run = (extra) =>
  execFileSync(
    process.execPath,
    [resolve('node_modules/wrangler/bin/wrangler.js'), ...args, ...extra],
    { encoding: 'utf8' },
  );
const rows = JSON.parse(
  run([
    '--command',
    'SELECT id,title,workspace_id FROM tasks WHERE deleted_at IS NULL ORDER BY created_at,id',
    '--json',
  ]),
)[0].results;
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const key = (t) => t.workspace_id + ':' + taskTitleKey(t.title);
const reserved = new Set(rows.map(key)),
  seen = new Set();
let renamed = 0;
const sql = rows.map((t) => {
  let title = t.title;
  if (seen.has(key(t))) {
    let n = 2;
    do {
      const suffix = ` (${n++})`;
      title = t.title.slice(0, 180 - suffix.length).trimEnd() + suffix;
    } while (reserved.has(key({ ...t, title })));
    renamed++;
    reserved.add(key({ ...t, title }));
  }
  seen.add(key(t));
  return `UPDATE tasks SET title=${q(title)},title_key=${q(taskTitleKey(title))} WHERE id=${q(t.id)} AND title=${q(t.title)} AND workspace_id=${q(t.workspace_id)} AND deleted_at IS NULL;`;
});
const dir = mkdtempSync(join(tmpdir(), 'forest-title-keys-'));
try {
  if (sql.length) {
    const file = join(dir, 'keys.sql');
    writeFileSync(file, sql.join('\n'));
    run(['--file', file]);
  }
  console.log(
    JSON.stringify({
      environment: remote ? 'remote' : 'local',
      checked: rows.length,
      renamed,
    }),
  );
} finally {
  rmSync(dir, { recursive: true });
}
