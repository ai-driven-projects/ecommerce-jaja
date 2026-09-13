import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { hasMigrations } from './lib.js';

describe('hasMigrations', () => {
  it('só considera pastas dentro de prisma/migrations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaja-cli-'));
    assert.equal(hasMigrations(root), false);
    fs.mkdirSync(path.join(root, 'prisma', 'migrations'), { recursive: true });
    fs.writeFileSync(path.join(root, 'prisma', 'migrations', 'migration_lock.toml'), '');
    assert.equal(hasMigrations(root), false);
    fs.mkdirSync(path.join(root, 'prisma', 'migrations', '20260912_init'));
    assert.equal(hasMigrations(root), true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
