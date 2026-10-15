import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { claudeArgs, claudeSession, isTemporaryLimit, parseEvent, sessionIdle } from '../../src/loops/claude.js';
import type { SessionSummary } from '../../src/loops/types.js';

test('evento de ferramenta vira atividade sem o prefixo da raiz', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', name: 'Read', input: { file_path: '/repo/apps/backend/x.ts' } },
        { type: 'text', text: 'Lendo  o\narquivo' },
      ],
    },
  });
  const { activities } = parseEvent(line, '/repo');
  assert.deepEqual(
    activities.map((a) => [a.kind, a.text]),
    [
      ['tool', 'Read apps/backend/x.ts'],
      ['text', 'Lendo o arquivo'],
    ],
  );
});

test('TodoWrite e StructuredOutput não aparecem; resultado é reconhecido', () => {
  const todo = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'TodoWrite', input: {} }] },
  });
  assert.deepEqual(parseEvent(todo, '/r').activities, []);
  const end = parseEvent(JSON.stringify({ type: 'result', is_error: false, total_cost_usd: 0.42, num_turns: 7 }), '/r');
  assert.equal(end.result?.total_cost_usd, 0.42);
  assert.deepEqual(parseEvent('não é json', '/r'), { activities: [] });
});

test('limite de uso e indisponibilidade esperam mais', () => {
  assert.ok(isTemporaryLimit({ is_error: true, api_error_status: 429 }, ''));
  assert.ok(isTemporaryLimit({ is_error: true, result: 'Usage limit reached' }, ''));
  assert.ok(isTemporaryLimit(undefined, 'Error: ECONNRESET'));
  assert.ok(!isTemporaryLimit({ is_error: true, result: 'tool failed' }, ''));
});

test('args: sessão nova, sem permissões, com proibições, modelo e esquema', () => {
  const args = claudeArgs({
    prompt: 'oi',
    system: 'regras',
    forbidden: ['Bash(git commit:*)', 'Edit(//x/**)'],
    model: 'opus',
    schema: { type: 'object' },
  });
  assert.equal(args[0], '-p');
  assert.ok(!args.includes('--resume') && !args.includes('--continue'));
  assert.ok(args.includes('--dangerously-skip-permissions'));
  const index = args.indexOf('--disallowedTools');
  assert.deepEqual(args.slice(index + 1, index + 3), ['Bash(git commit:*)', 'Edit(//x/**)']);
  assert.deepEqual(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2), ['--model', 'opus']);
  assert.equal(args.at(-1), '{"type":"object"}');
  assert.ok(!claudeArgs({ prompt: '', system: '', forbidden: [] }).includes('--model'));
});

test('ferramentas abertas e fechadas: o vigia de sessão parada não conta um build longo', () => {
  const use = parseEvent(
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] },
    }),
    '/r',
  );
  assert.deepEqual(use.tools, { opened: ['t1'], closed: [] });
  const end = parseEvent(
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } }),
    '/r',
  );
  assert.deepEqual(end.tools, { opened: [], closed: ['t1'] });
  assert.ok(sessionIdle(10_000, 0, 0, 5_000));
  assert.ok(!sessionIdle(10_000, 0, 1, 5_000), 'ferramenta rodando não é parada');
  assert.ok(!sessionIdle(10_000, 6_000, 0, 5_000));
});

// um `claude` falso: "parado" manda um evento e fica mudo; "ferramenta" demora numa ferramenta e termina
const SILENT_CLAUDE = `#!/usr/bin/env node
const ev = (o) => console.log(JSON.stringify(o))
ev({ type: 'assistant', message: { content: [{ type: 'text', text: 'Agora escrevo as specs.' }] } })
if (process.env.FAKE_MODE === 'idle') setTimeout(() => {}, 30000)
else {
    ev({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } })
    setTimeout(() => {
        ev({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } })
        ev({ type: 'result', is_error: false, total_cost_usd: 0.1, num_turns: 2 })
    }, 3000)
}
`;

async function sessionWithFakeClaude(mode: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-silent-'));
  fs.writeFileSync(path.join(dir, 'claude'), SILENT_CLAUDE, { mode: 0o755 });
  const previous = { PATH: process.env.PATH, FAKE_MODE: process.env.FAKE_MODE };
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
  process.env.FAKE_MODE = mode;
  const attempts: SessionSummary[] = [];
  const stop = new AbortController();
  try {
    const end = await claudeSession({
      label: 'propor',
      prompt: 'p',
      dir,
      root: dir,
      system: '',
      forbidden: [],
      timeoutMs: 20_000,
      // folga para o node do falso subir com a suíte inteira rodando em paralelo
      idleMs: 1500,
      signal: stop.signal,
      // sem esperar os 30s da nova tentativa: o teste só quer a primeira
      onAttemptEnd: (summary) => {
        attempts.push(summary);
        if (!summary.ok) stop.abort();
      },
    });
    return { end, attempts };
  } finally {
    process.env.PATH = previous.PATH;
    if (previous.FAKE_MODE === undefined) delete process.env.FAKE_MODE;
    else process.env.FAKE_MODE = previous.FAKE_MODE;
  }
}

test(
  'sessão sem sinal do Claude é encerrada pelo vigia, sem esperar o limite da sessão',
  { timeout: 15_000 },
  async () => {
    const { attempts } = await sessionWithFakeClaude('idle');
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]?.ok, false);
    assert.match(attempts[0]?.error ?? '', /sem nenhum sinal do Claude/);
    assert.ok((attempts[0]?.durationMs ?? 0) < 10_000, `levou ${attempts[0]?.durationMs}ms`);
  },
);

test('ferramenta demorada não conta como sessão parada', { timeout: 15_000 }, async () => {
  const { end, attempts } = await sessionWithFakeClaude('tool');
  assert.ok(end.ok, end.error);
  assert.equal(attempts.length, 1);
});
