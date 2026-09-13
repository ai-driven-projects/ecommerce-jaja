import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRegistry } from '../core/registry.js';
import { createCommands } from './index.js';

describe('createCommands', () => {
  it('monta um registro sem ids duplicados e com as entradas do menu inicial', () => {
    const registry = createRegistry(createCommands());
    assert.deepEqual(
      registry.roots().map((command) => command.id),
      ['doctor', 'setup', 'db', 'scrape', 'quality', 'clean', 'deploy', 'monitor'],
    );
    assert.equal(registry.find('db:start')?.group, 'Banco');
  });
});
