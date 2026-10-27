import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
if (!process.stdin.isTTY) throw new Error('Execute em um terminal interativo.');
const remote = process.argv.includes('--remote');
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
async function secret(prompt) {
  process.stdout.write(prompt);
  muted = true;
  const value = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  return value;
}
let password, confirmation;
try {
  console.log(
    `Configurar ti@forest.ind.br (${remote ? 'PRODUÇÃO' : 'local'}). A senha não será exibida.`,
  );
  password = await secret('Nova senha (8 a 128 caracteres): ');
  confirmation = await secret('Confirme a senha: ');
} finally {
  rl.close();
}
if (password.length < 8 || password.length > 128 || password !== confirmation)
  throw new Error(
    'Senha inválida ou confirmação diferente. Nada foi alterado.',
  );
const salt = randomBytes(32).toString('hex');
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
password = confirmation = '';
const dir = mkdtempSync(join(tmpdir(), 'forest-account-'));
try {
  const file = join(dir, 'account.sql');
  writeFileSync(
    file,
    `INSERT INTO team_credentials VALUES ('ti@forest.ind.br','${salt}','${hash}') ON CONFLICT(email) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash; DELETE FROM team_sessions;`,
  );
  const args = [
    resolve('node_modules/wrangler/bin/wrangler.js'),
    'd1',
    'execute',
    'DB',
    remote ? '--remote' : '--local',
    '--file',
    file,
  ];
  if (remote) args.push('--config', 'deployment/wrangler.jsonc');
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error('Não foi possível configurar a conta.');
  console.log(
    'Conta da equipe configurada. Entre no Forest Flow e selecione seu perfil.',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
