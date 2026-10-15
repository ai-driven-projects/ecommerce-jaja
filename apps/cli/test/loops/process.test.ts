import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { killOrphans, MAX_TAIL, onPath, run } from '../../src/loops/process.js';

test('run entrega as linhas e o código de saída', async () => {
  const lines: string[] = [];
  const result = await run('sh', ['-c', 'echo um; echo dois >&2; exit 3'], {
    cwd: '/',
    timeoutMs: 5000,
    onLine: (line) => lines.push(line),
  });
  assert.equal(result.code, 3);
  assert.deepEqual(lines.sort(), ['dois', 'um']);
  assert.equal(result.timedOut, false);
});

test('run guarda só a cauda em memória e a saída inteira no arquivo', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loops-proc-')), 'saida.log');
  const result = await run('sh', ['-c', 'i=0; while [ $i -lt 500 ]; do echo linha $i; i=$((i+1)); done'], {
    cwd: '/',
    timeoutMs: 5000,
    file,
  });
  assert.equal(result.tail.length, MAX_TAIL);
  assert.equal(result.tail.at(-1), 'linha 499');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 500);
});

test('run encerra o comando que passa do limite', async () => {
  const result = await run('sh', ['-c', 'sleep 5'], { cwd: '/', timeoutMs: 300 });
  assert.equal(result.timedOut, true);
  assert.equal(result.code, null);
});

test('run é cancelável por sinal', async () => {
  const control = new AbortController();
  setTimeout(() => control.abort(), 100);
  const result = await run('sh', ['-c', 'sleep 5'], { cwd: '/', timeoutMs: 5000, signal: control.signal });
  assert.equal(result.cancelled, true);
  assert.ok(result.durationMs < 3000);
});

test('comando inexistente não derruba o loop', async () => {
  const result = await run('comando-que-nao-existe-xyz', [], { cwd: '/', timeoutMs: 1000 });
  assert.equal(result.code, 127);
});

test('órfãos de um crash são encerrados pelo grupo de processos', async () => {
  const orphan = spawn('sh', ['-c', 'sleep 30 & sleep 30'], { detached: true, stdio: 'ignore' });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loops-')), 'filhos.json');
  fs.writeFileSync(file, JSON.stringify([orphan.pid]));
  assert.deepEqual(await killOrphans(file, 200), [orphan.pid]);
  assert.throws(() => process.kill(-(orphan.pid as number), 0));
  assert.ok(!fs.existsSync(file));
  assert.deepEqual(await killOrphans(file, 200), []);
});

test('onPath encontra comandos do sistema', () => {
  assert.ok(onPath('sh'));
  assert.ok(!onPath('comando-que-nao-existe-xyz'));
});
