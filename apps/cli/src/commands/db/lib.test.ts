import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { clearOrdersSql, hasMigrations, parseClearOrdersOutput, queuesToPurge } from './lib.js';

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

describe('clearOrdersSql', () => {
  const sql = clearOrdersSql();

  it('é uma única instrução, sem BEGIN/COMMIT', () => {
    assert.equal(sql.trim().split(';').filter((part) => part.trim()).length, 1);
    assert.equal(sql.trim().endsWith(';'), true);
    assert.doesNotMatch(sql, /\bBEGIN\b|\bCOMMIT\b/i);
  });

  it('apaga marcas → eventos → pedidos, filtrando os eventos de pedido', () => {
    const marks = sql.indexOf('DELETE FROM processed_messages');
    const events = sql.indexOf('DELETE FROM outbox_events');
    const orders = sql.indexOf('DELETE FROM orders');
    assert.ok(marks > 0 && events > marks && orders > events, 'ordem das remoções');
    assert.match(sql, /^WITH order_events AS \(SELECT id FROM outbox_events WHERE aggregate_type = 'Order'\)/);
    assert.match(sql, /DELETE FROM processed_messages WHERE message_id IN \(SELECT id FROM order_events\)/);
    assert.match(sql, /DELETE FROM outbox_events WHERE id IN \(SELECT id FROM order_events\)/);
    assert.doesNotMatch(sql, /order_items|customers|carts|products|users/);
  });

  it('termina com o SELECT das três contagens: pedidos, eventos e marcas', () => {
    assert.match(
      sql,
      /SELECT \(SELECT count\(\*\) FROM deleted_orders\), \(SELECT count\(\*\) FROM deleted_events\), \(SELECT count\(\*\) FROM deleted_marks\);\s*$/,
    );
  });
});

describe('parseClearOrdersOutput', () => {
  it('lê pedidos|eventos|marcas', () => {
    assert.deepEqual(parseClearOrdersOutput('3|15|12'), { orders: 3, events: 15, marks: 12 });
    assert.deepEqual(parseClearOrdersOutput('0|0|0\n'), { orders: 0, events: 0, marks: 0 });
  });

  it('falha (null) em saída inesperada', () => {
    for (const output of ['', 'DELETE 3', '3|15', '3|15|12|1', 'a|b|c', '-1|0|0', '3|15|12\n4|0|0', ' count \n-------\n 3']) {
      assert.equal(parseClearOrdersOutput(output), null, JSON.stringify(output));
    }
  });
});

describe('queuesToPurge', () => {
  it('mantém as filas jaja.* de consumidores, espera, descarte e inspeção', () => {
    const names = ['jaja.payment.approve-order', 'jaja.payment.approve-order.wait', 'jaja.payment.approve-order.dead', 'jaja.events.all'];
    assert.deepEqual(queuesToPurge(names), names);
  });

  it('exclui as filas jaja.live.* e as sem prefixo jaja.', () => {
    assert.deepEqual(
      queuesToPurge(['jaja.live.host.1.abc', 'jaja.store.start-picking', 'outra.fila', 'amq.gen-123', 'jajaxpto']),
      ['jaja.store.start-picking'],
    );
  });
});
