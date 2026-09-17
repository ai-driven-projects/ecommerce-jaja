import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRegistry } from '../core/registry.js';
import { createCommands } from './index.js';

describe('createCommands', () => {
  it('monta um registro sem ids duplicados e com as entradas do menu inicial', () => {
    const registry = createRegistry(createCommands());
    assert.deepEqual(
      registry.roots().map((command) => command.id),
      ['doctor', 'setup', 'db', 'broker', 'scrape', 'quality', 'clean', 'deploy', 'monitor'],
    );
    assert.equal(registry.find('db:start')?.group, 'Banco');
    assert.deepEqual(
      registry.find('db')?.children?.map((command) => command.id),
      ['db:status', 'db:start', 'db:stop', 'db:logs', 'db:generate', 'db:migrate', 'db:seed', 'db:reset', 'db:clear-orders', 'db:studio'],
    );
    assert.equal(registry.find('db:clear-orders')?.title, 'Limpar pedidos');
    assert.deepEqual(registry.find('db:clear-orders')?.keywords, ['pedidos', 'orders', 'limpar', 'demo']);
    assert.deepEqual(
      registry.find('broker')?.children?.map((command) => command.id),
      ['broker:status', 'broker:start', 'broker:stop', 'broker:logs', 'broker:queues'],
    );
    assert.equal(registry.find('broker:start')?.group, 'Mensageria');
    assert.equal(registry.find('broker:queues')?.group, 'Mensageria');
  });
});
