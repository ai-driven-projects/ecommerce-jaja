import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diffEnv, isPlaceholder, meetsMinimumMajor, parseDatabaseUrl, parseEnv, parseSubmoduleStatus } from './env.js';

describe('parseEnv', () => {
  it('ignora comentários, linhas vazias e remove aspas', () => {
    const parsed = parseEnv('# comentário\n\nA=1\nB="dois"\nC=\'três\'\nexport D=4\nINVALIDO\n');
    assert.deepEqual(parsed, { A: '1', B: 'dois', C: 'três', D: '4' });
  });

  it('mantém o sinal de igual dentro do valor', () => {
    assert.deepEqual(parseEnv('URL=postgresql://u:p@h:5433/db?schema=public'), { URL: 'postgresql://u:p@h:5433/db?schema=public' });
  });
});

describe('isPlaceholder', () => {
  it('detecta valores não preenchidos e aceita valores reais', () => {
    for (const value of ['', '   ', 'YOUR_SECRET_HERE', 'changeme', '<token>']) assert.equal(isPlaceholder(value), true, value);
    for (const value of ['jaja', 'sk-abc123', 'postgresql://jaja:jaja@localhost:5433/jaja']) assert.equal(isPlaceholder(value), false, value);
  });
});

describe('diffEnv', () => {
  it('lista chaves faltando e placeholders', () => {
    const example = parseEnv('DB_HOST=localhost\nJWT_SECRET=YOUR_SECRET_HERE\nPORT=4000');
    const actual = parseEnv('DB_HOST=localhost\nJWT_SECRET=YOUR_SECRET_HERE');
    assert.deepEqual(diffEnv(example, actual), { missing: ['PORT'], placeholders: ['JWT_SECRET'] });
  });
});

describe('parseDatabaseUrl', () => {
  it('extrai host, porta (padrão 5432), usuário e banco, e reconhece hosts remotos', () => {
    assert.deepEqual(parseDatabaseUrl('postgresql://u:p@localhost/db'), { host: 'localhost', port: 5432, isLocal: true, user: 'u', database: 'db' });
    assert.deepEqual(parseDatabaseUrl('postgresql://jaja:jaja@localhost:5433/jaja?schema=public'), { host: 'localhost', port: 5433, isLocal: true, user: 'jaja', database: 'jaja' });
    assert.deepEqual(parseDatabaseUrl('postgresql://u:p@ep-1.aws.neon.tech:5432/db?sslmode=require'), { host: 'ep-1.aws.neon.tech', port: 5432, isLocal: false, user: 'u', database: 'db' });
    assert.equal(parseDatabaseUrl('nada'), null);
  });

  it('decodifica usuário e banco e nunca devolve a senha', () => {
    const target = parseDatabaseUrl('postgresql://dev%40jaja:s3nh4@localhost:5433/loja%2Ddemo');
    assert.deepEqual(target, { host: 'localhost', port: 5433, isLocal: true, user: 'dev@jaja', database: 'loja-demo' });
    assert.equal(JSON.stringify(target).includes('s3nh4'), false);
    assert.deepEqual(parseDatabaseUrl('postgresql://localhost:5433'), { host: 'localhost', port: 5433, isLocal: true, user: '', database: '' });
  });
});

describe('meetsMinimumMajor', () => {
  it('compara apenas o major', () => {
    assert.equal(meetsMinimumMajor('v24.20.0', 24), true);
    assert.equal(meetsMinimumMajor('v22.0.0', 24), false);
    assert.equal(meetsMinimumMajor('abc', 24), false);
  });
});

describe('parseSubmoduleStatus', () => {
  it('interpreta os prefixos do git', () => {
    const output = [' a11829e .claude/skills (heads/main)', '-35afb5e packages/shared', '+35afb5e packages/other (heads/main)', 'U35afb5e packages/conflict (heads/main)'].join('\n');
    assert.deepEqual(parseSubmoduleStatus(output), [
      { path: '.claude/skills', state: 'ok' },
      { path: 'packages/shared', state: 'uninitialized' },
      { path: 'packages/other', state: 'mismatch' },
      { path: 'packages/conflict', state: 'conflict' },
    ]);
  });
});
