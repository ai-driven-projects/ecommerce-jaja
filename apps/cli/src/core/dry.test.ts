import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCommand } from './dry.js';

describe('formatCommand', () => {
  it('cita argumentos com espaços ou caracteres especiais', () => {
    assert.equal(formatCommand('docker', ['compose', 'up', '-d', 'postgres']), 'docker compose up -d postgres');
    assert.equal(formatCommand('sh', ['-c', 'echo "oi"']), `sh -c 'echo "oi"'`);
    assert.equal(formatCommand('x', ["it's"]), `x 'it'\\''s'`);
  });
});
