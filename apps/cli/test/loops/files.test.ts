import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { appendLine, readFrom, readJson, readTail, writeJson } from '../../src/loops/files.js';

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'loops-files-'));

test('escrita atômica grava o JSON inteiro e não deixa temporário', () => {
  const file = path.join(tempDir(), 'sub', 'loop.json');
  writeJson(file, { a: 1 });
  writeJson(file, { a: 2, b: [1, 2] });
  assert.deepEqual(readJson(file), { ok: true, value: { a: 2, b: [1, 2] } });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['loop.json']);
});

test('readJson distingue arquivo ausente de JSON inválido', () => {
  const dir = tempDir();
  assert.deepEqual(readJson(path.join(dir, 'nada.json')), { ok: false, error: 'missing' });
  fs.writeFileSync(path.join(dir, 'ruim.json'), '{ "a": ');
  const read = readJson(path.join(dir, 'ruim.json'));
  assert.equal(read.ok, false);
  assert.equal(!read.ok && read.error, 'invalid');
});

test('readTail lê só o fim de um arquivo grande, sem linha cortada', () => {
  const file = path.join(tempDir(), 'eventos.jsonl');
  for (let i = 0; i < 5000; i++) appendLine(file, `{"n":${i}}`);
  const lines = readTail(file, 1000);
  assert.ok(lines.length < 200);
  assert.equal(lines.at(-1), '{"n":4999}');
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
  assert.equal(readTail(file).length, 5000);
  assert.deepEqual(readTail(path.join(tempDir(), 'nao-existe')), []);
});

test('readFrom acompanha o arquivo pelo offset e deixa a linha incompleta para depois', () => {
  const file = path.join(tempDir(), 'eventos.jsonl');
  assert.deepEqual(readFrom(file, 0), { lines: [], offset: 0 });
  fs.writeFileSync(file, 'um\ndois\ntr');
  const first = readFrom(file, 0);
  assert.deepEqual(first.lines, ['um', 'dois']);
  fs.appendFileSync(file, 'ês\nquatro\n');
  const second = readFrom(file, first.offset);
  assert.deepEqual(second.lines, ['três', 'quatro']);
  assert.deepEqual(readFrom(file, second.offset).lines, []);
  // arquivo recriado menor: recomeça do início
  fs.writeFileSync(file, 'novo\n');
  assert.deepEqual(readFrom(file, second.offset).lines, ['novo']);
});
