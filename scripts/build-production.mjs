import { execFileSync } from 'node:child_process';
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  { stdio: 'inherit' },
);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, FOREST_PRODUCTION: '1' },
});
