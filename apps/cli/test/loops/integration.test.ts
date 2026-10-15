/**
 * O motor de ponta a ponta, num repositório git temporário, com `claude` e
 * `openspec` falsos no PATH: uma iteração completa, a retomada depois de matar o
 * processo no meio do apply, o vigia entregando um plano inteiro e a recuperação por agente.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DEFAULT_STEPS, EXIT } from '../../src/loops/config.js';
import { readJson } from '../../src/loops/files.js';
import { liveLock } from '../../src/loops/lock.js';
import { loopPaths, saveLoop, zeroTotals } from '../../src/loops/loops.js';
import { ITERATION_FILE, nodeCommand, WATCHER_FILE } from '../../src/loops/node.js';
import { killOrphans } from '../../src/loops/process.js';
import type { Loop } from '../../src/loops/types.js';

const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('fs'), path = require('path')
const args = process.argv.slice(2)
const prompt = args[args.indexOf('-p') + 1]
const first = prompt.split('\\n')[0]
const cwd = process.cwd()
const log = (t) => fs.appendFileSync(process.env.FAKE_LOG, t + '\\n')
const write = (rel, txt = 'x') => { fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true }); fs.writeFileSync(path.join(cwd, rel), txt) }
let structured
const m = first.match(/^\\/opsx:(propose|apply|archive) (\\S+)/)
if (first.startsWith('Passo **RECUPERAR')) {
    const change = prompt.match(/change \`([^\`]+)\`/)[1]
    const mode = process.env.FAKE_RECOVER || 'archive'
    log('recuperar ' + mode)
    if (mode === 'archive' && fs.existsSync(path.join(cwd, 'openspec/changes', change))) {
        fs.renameSync(path.join(cwd, 'openspec/changes', change), path.join(cwd, 'openspec/changes/archive/2026-10-05-' + change))
    }
    structured = mode === 'human'
        ? { resolved: false, cause: 'o registro de pacotes pede login', whatItDid: 'nada', needsHuman: true, whatToDo: 'faça login no npm' }
        : { resolved: mode === 'archive', cause: 'o archive não rodou', whatItDid: mode === 'archive' ? 'arquivei a change' : 'nada', needsHuman: false, whatToDo: '' }
} else if (first.startsWith('Passo **PREPARAR O BRIEFING')) {
    log('briefing')
    structured = { title: 'feat(app): entrega da etapa', comparison: 'nada ainda', description: 'faça a etapa' }
} else if (first.startsWith('Passo **REVISAR')) {
    log('revisar ' + prompt.match(/change \`([^\`]+)\`/)[1])
} else if (m && m[1] === 'propose') {
    log((prompt.includes('Esta proposta é antecipada') ? 'antecipar ' : 'propor ') + m[2])
    write('openspec/changes/' + m[2] + '/proposal.md', '## Why\\n')
    if (!(process.env.FAKE_EARLY_INCOMPLETE && prompt.includes('Esta proposta é antecipada'))) write('openspec/changes/' + m[2] + '/tasks.md', '## 1. A\\n\\n- [ ] 1.1 a\\n\\n## 2. B\\n\\n- [ ] 2.1 b\\n')
    if (args.includes('--json-schema')) structured = { title: 'feat(app): entrega da etapa', comparison: 'nada ainda' }
} else if (m && m[1] === 'apply') {
    const marker = path.join(process.env.FAKE_DIR, 'slept')
    if (process.env.FAKE_SLEEP_IN_APPLY && !fs.existsSync(marker)) {
        fs.writeFileSync(marker, '')
        log('apply-dormindo')
        setTimeout(() => {}, 60000)
        return
    }
    const file = path.join(cwd, 'openspec/changes', m[2], 'tasks.md')
    let tasks = fs.readFileSync(file, 'utf8')
    for (const line of prompt.split('\\n')) {
        const t = line.match(/^- \\[ \\] (.+)$/)
        if (t) tasks = tasks.replace('- [ ] ' + t[1], '- [x] ' + t[1])
    }
    fs.writeFileSync(file, tasks)
    if (!fs.existsSync(path.join(process.env.FAKE_DIR, 'broke'))) {
        fs.writeFileSync(path.join(process.env.FAKE_DIR, 'broke'), '')
        write('app/quebrado.txt')
    }
    write('app/feito-' + m[2] + '.txt')
    log('aplicar ' + m[2])
} else if (m && m[1] === 'archive') {
    log('arquivar ' + m[2])
    if (!process.env.FAKE_ARCHIVE_DOES_NOT_MOVE) fs.renameSync(path.join(cwd, 'openspec/changes', m[2]), path.join(cwd, 'openspec/changes/archive/2026-10-05-' + m[2]))
} else if (first.startsWith('A verificação do loop falhou')) {
    log('corrigir')
    fs.rmSync(path.join(cwd, 'app/quebrado.txt'), { force: true })
    if (process.env.FAKE_FIX_WITH_SKIP) write('app/a.spec.ts', "it.skip('a', () => {});")
}
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'trabalhando' }] } }))
console.log(JSON.stringify({ type: 'result', is_error: false, total_cost_usd: 0.1, num_turns: 2, structured_output: structured }))
`;

const FAKE_OPENSPEC = `#!/usr/bin/env node
const fs = require('fs'), path = require('path')
const [cmd, name] = process.argv.slice(2)
if (cmd === 'archive' && process.env.FAKE_OPENSPEC_ARCHIVE_FAILS) {
    console.error('erro: não foi possível arquivar ' + name)
    process.exit(1)
}
if (cmd === 'archive') fs.renameSync(path.join(process.cwd(), 'openspec/changes', name), path.join(process.cwd(), 'openspec/changes/archive/2026-10-05-' + name))
process.exit(0)
`;

function prepareRepo(stageCount: number) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-e2e-'));
  const fakes = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-fakes-'));
  for (const [name, content] of [
    ['claude', FAKE_CLAUDE],
    ['openspec', FAKE_OPENSPEC],
  ] as const) {
    fs.writeFileSync(path.join(fakes, name), content, { mode: 0o755 });
  }
  const g = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'app'));
  fs.mkdirSync(path.join(root, 'openspec/changes/archive'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/base.txt'), 'base');
  fs.writeFileSync(path.join(root, 'openspec/changes/archive/.gitkeep'), '');

  const paths = loopPaths('demo', root);
  const numbers = Array.from({ length: stageCount }, (_, i) => i + 1);
  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(
    paths.plan,
    `# Demo\n\n## Objetivo\n\nTestar.\n\n## Regras\n\n- nenhuma\n\n## Fase 1 · Única\n\n${numbers.map((n) => `${n}. **Etapa ${n}** · \`demo-0${n}-etapa\` — faz ${n}`).join('\n')}\n`,
  );
  const loop: Loop = {
    format: 1,
    name: 'demo',
    title: 'Demo',
    createdAt: new Date().toISOString(),
    status: 'pending',
    config: {
      scope: ['app'],
      commitPrefix: 'feat(app)',
      requiredCommands: [],
      checks: [
        {
          id: 'sem-quebra',
          label: 'sem quebra',
          command: ['node', '-e', "process.exit(require('fs').existsSync('quebrado.txt') ? 1 : 0)"],
          dir: 'app',
        },
      ],
      forbiddenTools: [],
      steps: [...DEFAULT_STEPS],
      limits: { attemptsPerStep: 1, sessionMin: 1, commandMin: 1 },
    },
    stages: numbers.map((n) => ({
      number: n,
      phase: 'Única',
      title: `Etapa ${n}`,
      change: `demo-0${n}-etapa`,
      status: 'pending' as const,
    })),
    iteration: null,
    totals: zeroTotals(),
  };
  saveLoop(paths, loop);
  fs.writeFileSync(path.join(root, '.gitignore'), 'openspec/loops/*/.execucao/\n');
  g('add', '.');
  g('commit', '-qm', 'base');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${fakes}${path.delimiter}${process.env.PATH}`,
    LOOPS_ROOT: root,
    LOOPS_RETRY_WAIT_MS: '10',
    LOOPS_INTERVAL_MS: '10',
    FAKE_LOG: path.join(fakes, 'calls.log'),
    FAKE_DIR: fakes,
  };
  const calls = () =>
    fs.existsSync(env.FAKE_LOG as string)
      ? fs
          .readFileSync(env.FAKE_LOG as string, 'utf8')
          .trim()
          .split('\n')
      : [];
  const savedLoop = () => {
    const read = readJson<Loop>(paths.loop);
    assert.ok(read.ok);
    return read.value;
  };
  return { root, paths, env, g, calls, savedLoop };
}

function runScript(script: string, env: NodeJS.ProcessEnv, extraEnv: NodeJS.ProcessEnv = {}) {
  const { command, args } = nodeCommand(script, ['demo']);
  const child = spawn(command, args, {
    cwd: env.LOOPS_ROOT,
    env: { ...env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => (output += data));
  child.stderr.on('data', (data) => (output += data));
  const end = new Promise<{ code: number | null; output: string }>((resolve) =>
    child.on('exit', (code) => resolve({ code, output })),
  );
  return { child, end };
}

async function waitUntil(condition: () => boolean, ms = 30_000) {
  const limit = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > limit) throw new Error('tempo esgotado esperando a condição');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const events = (file: string) =>
  fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

test(
  'iteração completa com correção, retomada depois de morrer no apply e totais somados',
  { timeout: 90_000 },
  async () => {
    const { paths, env, g, calls, savedLoop } = prepareRepo(1);

    // 1ª execução: morre (SIGKILL, como falta de memória) enquanto o Claude aplica
    const first = runScript(ITERATION_FILE, env, { FAKE_SLEEP_IN_APPLY: '1' });
    await waitUntil(() => calls().includes('apply-dormindo'));
    first.child.kill('SIGKILL');
    await first.end;
    assert.equal((await killOrphans(paths.children, 200)).length, 1);

    const middle = savedLoop();
    assert.equal(middle.iteration?.currentStep, 3);
    assert.deepEqual(
      middle.iteration?.steps.slice(0, 3).map((step) => step.state),
      ['ok', 'ok', 'ok'],
    );
    // o título do commit vem da própria proposta, sem passo de briefing
    assert.equal(middle.iteration?.briefing?.title, 'entrega da etapa');
    assert.equal(Math.round(middle.totals.cost * 10), 1);

    // 2ª execução: retoma no apply, sem refazer a proposta
    const second = runScript(ITERATION_FILE, env);
    const { code, output } = await second.end;
    assert.equal(code, EXIT.done, output);

    const loop = savedLoop();
    assert.equal(calls().filter((call) => call === 'briefing').length, 0);
    assert.equal(calls().filter((call) => call.startsWith('propor')).length, 1);
    assert.equal(calls().filter((call) => call === 'corrigir').length, 1);
    assert.equal(loop.iteration, null);
    assert.equal(loop.stages[0]?.status, 'delivered');
    assert.match(loop.stages[0]?.commit ?? '', /^[0-9a-f]{40}$/);
    const t = loop.totals;
    assert.deepEqual(
      [t.iterationsStarted, t.iterationsDelivered, t.fixes, t.commits, t.claudeSessions],
      [1, 1, 1, 2, 4],
    );
    assert.equal(Math.round(t.cost * 10), 4);
    assert.ok(t.durationMs > 0);
    assert.ok(t.checks >= 4);

    assert.deepEqual(g('log', '--format=%s').trim().split('\n'), [
      'feat(app): entrega da etapa',
      'docs(openspec): propõe demo-01-etapa',
      'base',
    ]);
    const delivery = g('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort();
    assert.ok(delivery.includes('openspec/loops/demo/loop.json'));
    assert.ok(delivery.includes('app/feito-demo-01-etapa.txt'));
    assert.ok(delivery.some((file) => file.startsWith('openspec/changes/archive/2026-10-05-demo-01-etapa/')));
    assert.ok(!delivery.some((file) => file.includes('.execucao')));
  },
);

test(
  'vigia entrega o plano inteiro, uma iteração por processo, com a proposta seguinte antecipada',
  { timeout: 90_000 },
  async () => {
    const { paths, env, g, calls, savedLoop } = prepareRepo(2);
    const { output } = await runScript(WATCHER_FILE, env).end;
    const loop = savedLoop();
    assert.equal(loop.status, 'done', output);
    assert.deepEqual(
      loop.stages.map((stage) => stage.status),
      ['delivered', 'delivered'],
    );
    assert.equal(loop.totals.runs, 1);
    assert.equal(loop.totals.iterationsDelivered, 2);
    assert.equal(loop.lastRun?.outcome, 'done');
    // a etapa 2 foi proposta em paralelo ao apply da 1 e, na iteração dela, só revisada
    assert.deepEqual(
      calls().filter((call) => /^(propor|antecipar|revisar|briefing)/.test(call)),
      ['propor demo-01-etapa', 'antecipar demo-02-etapa', 'revisar demo-02-etapa'],
    );
    assert.match(loop.stages[1]?.early?.commit ?? '', /^[0-9a-f]{40}$/);
    assert.deepEqual(g('log', '--format=%s').trim().split('\n'), [
      'feat(app): entrega da etapa',
      'docs(openspec): revisa demo-02-etapa contra a etapa anterior entregue',
      'feat(app): entrega da etapa',
      'docs(openspec): propõe demo-02-etapa',
      'docs(openspec): propõe demo-01-etapa',
      'base',
    ]);
    assert.equal(liveLock(paths.lock), null);
    // cada iteração foi um processo diferente
    const pids = new Set(
      events(paths.events)
        .filter((event) => event.type === 'iteration_end')
        .map((event) => event.pid),
    );
    assert.equal(pids.size, 2);
  },
);

test(
  'proposta antecipada incompleta é descartada e a etapa seguinte é proposta do jeito normal',
  { timeout: 90_000 },
  async () => {
    const { root, env, g, calls, savedLoop } = prepareRepo(2);
    const { output } = await runScript(WATCHER_FILE, env, { FAKE_EARLY_INCOMPLETE: '1' }).end;
    const loop = savedLoop();
    assert.equal(loop.status, 'done', output);
    assert.equal(loop.stages[1]?.early, undefined);
    assert.deepEqual(
      calls().filter((call) => /^(propor|antecipar|revisar)/.test(call)),
      ['propor demo-01-etapa', 'antecipar demo-02-etapa', 'propor demo-02-etapa'],
    );
    // a sobra não entrou em nenhum commit e não travou a etapa 2 por escopo sujo
    assert.equal(
      g('log', '--format=%s')
        .split('\n')
        .filter((subject) => subject === 'docs(openspec): propõe demo-02-etapa').length,
      1,
    );
    assert.equal(g('status', '--porcelain', '--', 'openspec/changes').trim(), '');
    assert.ok(fs.existsSync(path.join(root, 'openspec/changes/archive/2026-10-05-demo-02-etapa/tasks.md')));
  },
);

test(
  'loop de specs já criadas: sem proposta nem antecipação, direto ao apply, sem apagar a spec do usuário',
  { timeout: 90_000 },
  async () => {
    const { root, paths, env, g, calls, savedLoop } = prepareRepo(2);
    const tasks = '## 1. A\n\n- [ ] 1.1 a\n';
    // a segunda tem nome no padrão do loop: só a marca diz que ela já está pronta
    for (const name of ['spec-commitada', 'demo-02-no-padrao']) {
      fs.mkdirSync(path.join(root, 'openspec/changes', name), { recursive: true });
      fs.writeFileSync(path.join(root, 'openspec/changes', name, 'proposal.md'), `## Why\n\n${name}\n`);
      fs.writeFileSync(path.join(root, 'openspec/changes', name, 'tasks.md'), tasks);
    }
    fs.writeFileSync(
      paths.plan,
      '# Demo\n\n## Objetivo\n\nTestar.\n\n## Fase 1 · Specs existentes\n\n1. **Commitada** · `spec-commitada` · spec pronta\n2. **No disco** · `demo-02-no-padrao` · spec pronta\n',
    );
    saveLoop(paths, {
      ...savedLoop(),
      stages: [
        {
          number: 1,
          phase: 'Specs existentes',
          title: 'Commitada',
          change: 'spec-commitada',
          status: 'pending',
          readySpec: true,
        },
        {
          number: 2,
          phase: 'Specs existentes',
          title: 'No disco',
          change: 'demo-02-no-padrao',
          status: 'pending',
          readySpec: true,
        },
      ],
    });
    g('add', 'openspec/loops', 'openspec/changes/spec-commitada');
    g('commit', '-qm', 'specs');

    const { output } = await runScript(WATCHER_FILE, env).end;
    const loop = savedLoop();
    assert.equal(loop.status, 'done', output);
    assert.deepEqual(
      calls().filter((call) => /^(propor|antecipar|revisar|briefing|aplicar)/.test(call)),
      ['aplicar spec-commitada', 'aplicar demo-02-no-padrao'],
    );
    const subjects = g('log', '--format=%s').trim().split('\n');
    assert.ok(subjects.includes('docs(openspec): adota demo-02-no-padrao no loop demo'), subjects.join('\n'));
    assert.ok(fs.existsSync(path.join(root, 'openspec/changes/archive/2026-10-05-demo-02-no-padrao/tasks.md')));
    assert.equal(loop.iteration, null);
    assert.ok(loop.stages.every((stage) => !stage.early));
  },
);

test('iniciar pelo CLI sobe o vigia destacado, que segue sozinho até concluir', { timeout: 90_000 }, async () => {
  const { startLoop } = await import('../../src/loops/control.js');
  const { root, paths, env, savedLoop } = prepareRepo(1);
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    const result = await startLoop('demo', root);
    assert.deepEqual(result.problems, []);
    assert.ok(result.pid && result.pid !== process.pid);
    // o vigia está em outro grupo de processos: não é filho preso a este
    await waitUntil(() => liveLock(paths.lock) === null && savedLoop().status !== 'running', 60_000);
  } finally {
    process.env = previous;
  }
  const loop = savedLoop();
  assert.equal(loop.status, 'done');
  assert.equal(loop.stages[0]?.status, 'delivered');
  assert.match(fs.readFileSync(paths.log, 'utf8'), /vigia · parou: done/);
});

// ─── recuperação por agente ──────────────────────────────────────────────────

const BROKEN_ARCHIVE = { FAKE_ARCHIVE_DOES_NOT_MOVE: '1', FAKE_OPENSPEC_ARCHIVE_FAILS: '1' };

test('recuperação resolve o arquivamento e o fluxo segue sem reexecutar o passo', { timeout: 90_000 }, async () => {
  const { paths, env, calls, savedLoop } = prepareRepo(1);
  const { code, output } = await runScript(ITERATION_FILE, env, { ...BROKEN_ARCHIVE, FAKE_RECOVER: 'archive' }).end;
  assert.equal(code, EXIT.done, output);
  const loop = savedLoop();
  assert.equal(loop.stages[0]?.status, 'delivered');
  assert.deepEqual([loop.totals.recoveries, loop.totals.recoveriesResolved, loop.totals.failures], [1, 1, 0]);
  // o passo não foi executado de novo: um /opsx:archive só
  assert.equal(calls().filter((call) => call.startsWith('arquivar')).length, 1);
  const recoveries = events(paths.events).filter((event) => event.type === 'recovery');
  assert.equal(recoveries.length, 1);
  assert.equal(recoveries[0]?.resolved, true);
  assert.equal(recoveries[0]?.cause, 'o archive não rodou');
});

test(
  'recuperação que pede uma pessoa: vigia para em waiting e continuar retoma o mesmo passo',
  { timeout: 120_000 },
  async () => {
    const { env, calls, savedLoop } = prepareRepo(1);
    await runScript(WATCHER_FILE, env, { ...BROKEN_ARCHIVE, FAKE_RECOVER: 'human' }).end;
    let loop = savedLoop();
    assert.equal(loop.status, 'waiting');
    assert.equal(loop.lastRun?.whatToDo, 'faça login no npm');
    assert.equal(loop.lastRun?.reason, 'o registro de pacotes pede login');
    assert.equal(loop.iteration?.steps[loop.iteration.currentStep]?.id, 'archive');

    // a pessoa resolveu: continuar retoma o arquivamento, sem refazer a proposta
    await runScript(WATCHER_FILE, env).end;
    loop = savedLoop();
    assert.equal(loop.status, 'done');
    assert.equal(loop.totals.runs, 2);
    assert.equal(calls().filter((call) => call.startsWith('propor')).length, 1);
    assert.equal(loop.lastRun?.whatToDo, undefined);
  },
);

test('correção que pula um teste é recusada e o loop fica aguardando', { timeout: 90_000 }, async () => {
  const { env, savedLoop } = prepareRepo(1);
  const { code, output } = await runScript(ITERATION_FILE, env, { FAKE_FIX_WITH_SKIP: '1' }).end;
  assert.equal(code, EXIT.waiting, output);
  const last = savedLoop().lastRun;
  assert.match(last?.reason ?? '', /desligou verificações/);
  assert.match(last?.whatToDo ?? '', /app\/a\.spec\.ts: it\.skip\('a', \(\) => \{\}\);/);
});

test('mesmo erro depois da recuperação registra a falha sem segunda recuperação', { timeout: 90_000 }, async () => {
  const { paths, env, calls, savedLoop } = prepareRepo(1);
  // com execuções sobrando, o passo roda de novo depois da recuperação e falha igual
  const initial = savedLoop();
  saveLoop(paths, {
    ...initial,
    config: { ...initial.config, limits: { ...initial.config.limits, attemptsPerStep: 3 } },
  });
  const { code, output } = await runScript(ITERATION_FILE, env, { ...BROKEN_ARCHIVE, FAKE_RECOVER: 'nothing' }).end;
  assert.equal(code, EXIT.failed, output);
  const loop = savedLoop();
  assert.deepEqual([loop.totals.recoveries, loop.totals.recoveriesResolved, loop.totals.failures], [1, 0, 1]);
  assert.match(loop.lastRun?.reason ?? '', /mesmo erro depois da recuperação/);
  assert.equal(calls().filter((call) => call.startsWith('arquivar')).length, 2);
  assert.equal(calls().filter((call) => call.startsWith('recuperar')).length, 1);
});

test(
  'pasta do próprio loop alterada não trava a etapa nova, mesmo com openspec no escopo, e entra no commit',
  { timeout: 90_000 },
  async () => {
    const { paths, env, g, savedLoop } = prepareRepo(1);
    const initial = savedLoop();
    // como o vigia faz entre iterações: grava o loop.json depois do último commit
    saveLoop(paths, { ...initial, status: 'waiting', config: { ...initial.config, scope: ['app', 'openspec'] } });
    fs.appendFileSync(paths.plan, '\n## Fora do escopo\n\nNada.\n');
    const { code, output } = await runScript(ITERATION_FILE, env).end;
    assert.equal(code, EXIT.done, output);
    // sem correção no ponto de partida, nada de commit "restaura as verificações"
    assert.deepEqual(g('log', '--format=%s').trim().split('\n'), [
      'feat(app): entrega da etapa',
      'docs(openspec): propõe demo-01-etapa',
      'base',
    ]);
    const proposal = g('show', '--name-only', '--format=', 'HEAD~1').trim().split('\n');
    assert.ok(proposal.includes('openspec/loops/demo/plano.md'), proposal.join('\n'));
    assert.equal(g('status', '--porcelain', '--', 'openspec/loops/demo/plano.md').trim(), '');
  },
);

test('escopo sujo antes de uma etapa nova: aguardando, sem chamar o Claude', { timeout: 60_000 }, async () => {
  const { root, env, calls, savedLoop } = prepareRepo(1);
  fs.writeFileSync(path.join(root, 'app/sujo.txt'), 'x');
  const { code } = await runScript(ITERATION_FILE, env).end;
  assert.equal(code, EXIT.waiting);
  assert.deepEqual(calls(), []);
  assert.match(savedLoop().lastRun?.whatToDo ?? '', /commite ou guarde/);
});
