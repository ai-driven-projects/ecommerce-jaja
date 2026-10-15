/**
 * O vigia de um loop: roda em segundo plano, destacado do CLI, e executa cada
 * iteração num processo novo.
 *
 *   node --import tsx src/loops/watcher.ts <nome-do-loop>     (ou dist/loops/watcher.js)
 *
 * - Processo novo por iteração: memória e estado do Node começam limpos a cada
 *   etapa (um processo único acumula memória ao longo de muitas iterações).
 * - Crash (erro inesperado, falta de memória, processo morto): encerra os filhos
 *   órfãos, espera um pouco e roda de novo; o loop.json retoma o passo.
 * - Mantém o Mac acordado enquanto viver (`caffeinate -w`).
 * - Fechar o CLI ou o terminal não o afeta; "parar agora" é um SIGTERM.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { effectiveConfig, ENV, EXIT, loopsRoot } from './config.js';
import { appendLine, readJson, writeJson } from './files.js';
import { clock, errorMessage, longDuration } from './format.js';
import { keepAwake } from './keep-awake.js';
import { acquireLock, releaseLock } from './lock.js';
import { type LoopPaths, loopPaths, readLoop, saveLoop } from './loops.js';
import { isEntry, ITERATION_FILE, nodeCommand } from './node.js';
import { killOrphans, sleep } from './process.js';
import type { Control, Loop, LoopStatus } from './types.js';
import { decideAfterExit, type Next } from './watcher-rules.js';

const KILL_WAIT_MS = 15_000;

function logger(paths: LoopPaths) {
  return (text: string, level: 'info' | 'warn' | 'error' | 'ok' = 'info') => {
    console.log(`[${clock(Date.now())}] vigia · ${text}`);
    appendLine(
      paths.events,
      JSON.stringify({ ts: new Date().toISOString(), type: 'log', level, text: `vigia · ${text}` }),
    );
  };
}

/** Lê, altera e grava o loop.json (só entre iterações: nunca com um filho rodando). */
function update(paths: LoopPaths, fn: (loop: Loop) => void) {
  try {
    const loop = readLoop(paths);
    fn(loop);
    saveLoop(paths, loop);
  } catch (error) {
    console.error('vigia · não consegui atualizar o loop.json:', error);
  }
}

const pauseRequested = (paths: LoopPaths) => {
  const read = readJson<Control>(paths.control);
  return read.ok && read.value.pause;
};

export async function runWatcher(name: string, root = loopsRoot()): Promise<number> {
  const paths = loopPaths(name, root);
  const log = logger(paths);
  const other = acquireLock(paths.lock);
  if (other) {
    console.error(`vigia · o loop ${name} já está rodando (pid ${other})`);
    return EXIT.failed;
  }

  let child: ChildProcess | undefined;
  let stopping = false;
  const cancelWait = new AbortController();
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    cancelWait.abort();
    log(`recebeu ${signal}; encerrando a iteração atual`, 'warn');
    if (!child) return;
    child.kill('SIGTERM');
    const running = child;
    setTimeout(() => {
      if (running.exitCode === null && running.signalCode === null) {
        log('a iteração não terminou a tempo; encerrando à força', 'warn');
        running.kill('SIGKILL');
      }
    }, KILL_WAIT_MS).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  // destacado do terminal: fechar a janela não pode parar o loop
  process.on('SIGHUP', () => {});

  const start = Date.now();
  let status: LoopStatus = 'interrupted';
  let reason: string | undefined;
  let delivered = 0;
  let consecutiveCrashes = 0;
  try {
    writeJson(paths.control, { pause: false } satisfies Control);
    update(paths, (loop) => {
      loop.status = 'running';
      loop.totals.runs++;
      loop.lastRun = { start: new Date().toISOString() };
    });
    if (!keepAwake() && process.platform === 'darwin')
      log('caffeinate indisponível: o Mac pode entrar em repouso durante o loop', 'warn');
    log(`iniciado (pid ${process.pid}) · uma iteração por processo`);

    for (;;) {
      const limits = effectiveConfig(readLoop(paths).config).limits;
      const orphans = await killOrphans(paths.children);
      if (orphans.length)
        log(`encerrou ${orphans.length} processo(s) deixado(s) pela iteração anterior: ${orphans.join(', ')}`, 'warn');
      if (stopping) {
        reason = 'parado pelo usuário';
        break;
      }
      if (pauseRequested(paths)) {
        status = 'paused';
        reason = 'pausado a pedido';
        break;
      }

      const { command, args } = nodeCommand(ITERATION_FILE, [name]);
      const iteration = spawn(command, args, {
        cwd: root,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, LOOPS_ROOT: root },
      });
      child = iteration;
      const { code, signal } = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
        iteration.on('error', () => resolve({ code: EXIT.unexpected, signal: null }));
        iteration.on('exit', (exitCode, exitSignal) => resolve({ code: exitCode, signal: exitSignal }));
      });
      child = undefined;

      const next: Next = stopping
        ? { action: 'stop', status: 'interrupted', reason: 'parado pelo usuário' }
        : decideAfterExit(code, signal, consecutiveCrashes, limits.restarts);
      log(`iteração terminou (código ${code ?? '—'}${signal ? `, sinal ${signal}` : ''}) → ${next.action}`);

      if (next.action === 'stop') {
        status = next.status;
        // falha registrada e aguardando já têm o motivo (e o que fazer) gravados pela iteração
        reason = code === EXIT.failed || code === EXIT.waiting ? undefined : next.reason;
        break;
      }
      if (next.action === 'recover') {
        consecutiveCrashes++;
        update(paths, (loop) => loop.totals.restarts++);
        log(
          `crash: ${next.reason}. Recuperação ${consecutiveCrashes} de ${limits.restarts} em ${longDuration(next.waitMs)}; o loop.json retoma o passo.`,
          'error',
        );
        await sleep(next.waitMs, cancelWait.signal);
        continue;
      }
      delivered++;
      consecutiveCrashes = 0;
      if (delivered >= limits.iterationsPerRun) {
        status = 'paused';
        reason = `limite de ${limits.iterationsPerRun} iteração(ões) nesta execução; continue para seguir`;
        break;
      }
      log(`etapa entregue (${delivered} nesta execução); a próxima iteração começa num processo novo`, 'ok');
      await sleep(ENV.iterationIntervalMs(), cancelWait.signal);
    }
  } catch (error) {
    status = 'failed';
    reason = `erro no vigia: ${errorMessage(error)}`;
  } finally {
    await killOrphans(paths.children, 2000);
    update(paths, (loop) => {
      loop.status = status;
      loop.lastRun = {
        start: new Date(start).toISOString(),
        ...loop.lastRun,
        end: new Date().toISOString(),
        outcome: status,
      };
      if (reason) loop.lastRun.reason = reason;
    });
    writeJson(paths.control, { pause: false } satisfies Control);
    log(
      `parou: ${status}${reason ? ` (${reason})` : ''} · ${delivered} etapa(s) entregue(s) em ${longDuration(Date.now() - start)}`,
    );
    releaseLock(paths.lock);
  }
  return status === 'done' || status === 'paused' ? 0 : 1;
}

if (isEntry(fileURLToPath(import.meta.url))) {
  const name = process.argv[2];
  if (!name) {
    console.error('uso: watcher <nome-do-loop>');
    process.exit(1);
  }
  void runWatcher(name).then((code) => process.exit(code));
}
