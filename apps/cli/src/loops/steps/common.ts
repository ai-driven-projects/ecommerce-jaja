import path from 'node:path';
import { readableCommand, runChecks } from '../checks.js';
import { claudeSession, type SessionEnd } from '../claude.js';
import { ENV, TRAILER } from '../config.js';
import { oneLine } from '../format.js';
import { commitPaths, iterationPathspecs, outsideScope, short, status } from '../git.js';
import { disablements, snapshot } from '../guard.js';
import { sleep } from '../process.js';
import { buildPrompt } from '../prompts.js';
import { Cancelled, type IterationContext, NeedsHuman, StepFailure } from './context.js';

/** Executa fn a cada intervalo enquanto a promessa não termina (progresso ao vivo). */
export async function whilePending<T>(promise: Promise<T>, fn: () => void, ms = 3000): Promise<T> {
  const timer = setInterval(fn, ms);
  try {
    return await promise;
  } finally {
    clearInterval(timer);
    fn();
  }
}

/** Uma sessão nova do Claude. Lança StepFailure se ela falhar depois das novas tentativas. */
export async function claude(
  ctx: IterationContext,
  label: string,
  prompt: string,
  extras: { schema?: object; extraForbidden?: string[] } = {},
): Promise<SessionEnd> {
  const { monitor } = ctx;
  const end = await claudeSession({
    label,
    prompt,
    dir: ctx.dir,
    root: ctx.paths.root,
    system: ctx.system,
    forbidden: [...ctx.forbidden, ...(extras.extraForbidden ?? [])],
    model: ctx.config.model,
    schema: extras.schema,
    timeoutMs: ctx.config.limits.sessionMin * 60_000,
    idleMs: ctx.config.limits.sessionIdleMin * 60_000,
    signal: ctx.signal,
    onActivity: (activity) => monitor.activity(activity),
    onLog: (text) => monitor.log('command', text),
    onWait: (text) => monitor.waiting(text),
    onAttemptStart: (text) => monitor.startSession(text),
    onAttemptEnd: (summary) => monitor.recordSession(summary),
  });
  if (end.cancelled || ctx.signal.aborted) throw new Cancelled();
  if (!end.ok) throw new StepFailure(`sessão do Claude (${label}) falhou: ${end.error}`, { file: end.file });
  return end;
}

/** Avisa se surgiram alterações fora do escopo (do Claude ou de outra pessoa). Não falha. */
export function checkScope(ctx: IterationContext) {
  const now = status(ctx.paths.root, outsideScope(ctx.config.scope));
  const fresh = now.filter((line) => !ctx.outsideBefore.includes(line));
  if (!fresh.length) return;
  ctx.outsideBefore.push(...fresh);
  ctx.monitor.warn(
    `alterações novas fora do escopo (não entram no commit): ${fresh.slice(0, 4).join(', ')}${fresh.length > 4 ? '…' : ''}`,
  );
}

/** A pasta do loop (plano.md e loop.json; o .execucao/ fica de fora pelo .gitignore). */
export const relativeLoopDir = (ctx: IterationContext) => path.relative(ctx.paths.root, ctx.paths.dir);

/** Commit restrito ao escopo, à pasta do loop e (sem scopeOnly) aos arquivos OpenSpec da change. */
export function commit(ctx: IterationContext, message: string, scopeOnly = false) {
  const item = ctx.monitor.item(scopeOnly ? 'commit-fix' : 'commit', scopeOnly ? 'Commit da correção' : 'git commit');
  const specs = iterationPathspecs(ctx.paths.root, {
    scope: ctx.config.scope,
    extras: [relativeLoopDir(ctx)],
    change: ctx.stage.change,
    scopeOnly,
  });
  ctx.monitor.log('command', `git commit -- ${specs.join(' ')}`);
  const result = commitPaths(ctx.paths.root, message, specs, TRAILER);
  if (!result) {
    item.skipped('nada para commitar');
    return null;
  }
  const subject = message.split('\n')[0] ?? '';
  item.ok(`${short(result.hash)} · ${result.files.length} arquivo(s) · ${oneLine(subject, 70)}`);
  ctx.monitor.event('commit', { hash: result.hash, message: subject, files: result.files.length });
  for (const file of result.files.slice(0, 50)) ctx.monitor.log('output', `  ${file}`);
  return result;
}

export const checksText = (ctx: Pick<IterationContext, 'config'>) =>
  ctx.config.checks.length
    ? ctx.config.checks.map((check) => `- \`${readableCommand(check)}\``).join('\n')
    : '- (este loop não tem verificações configuradas)';

/**
 * Verificações do loop com correção automática: repete uma vez para descartar
 * falha intermitente e, se continuar falhando, pede uma correção ao Claude, até
 * o limite. Sem verificações configuradas, o passo é pulado. Devolve quantas
 * correções o Claude aplicou.
 */
export async function verifyWithFixes(
  ctx: IterationContext,
  moment: 'baseline' | 'delivery',
): Promise<'skipped' | number> {
  const { config, monitor } = ctx;
  if (!config.checks.length) {
    monitor.item('checks', 'Verificações', 'skipped', 'o loop não tem verificações configuradas');
    return 'skipped';
  }
  const name = ctx.stage.change;
  const guidance =
    moment === 'baseline'
      ? {
          MOMENTO: `no ponto de partida, antes de aplicar a change ${name}`,
          ORIENTACAO: `O problema já existia antes desta change: corrija a causa sem implementar nada da change ${name}.`,
        }
      : {
          MOMENTO: `depois de aplicar a change ${name}`,
          ORIENTACAO: `A correção deve manter tudo o que a spec da change ${name} pede.`,
        };
  const verify = (round: string) =>
    runChecks(config.checks, {
      root: ctx.paths.root,
      dir: ctx.dir,
      round,
      timeoutMs: config.limits.commandMin * 60_000,
      monitor,
      signal: ctx.signal,
    });
  for (let fix = 0; ; fix++) {
    const round = fix === 0 ? '1ª rodada' : `após correção ${fix}`;
    let failure = await verify(round);
    if (!failure) return fix;
    if (ctx.signal.aborted) throw new Cancelled();
    // um watcher ou outro processo derruba o build às vezes
    monitor.warn('verificação falhou; repetindo uma vez para descartar falha intermitente');
    await sleep(ENV.checkRetryWaitMs(), ctx.signal);
    failure = await verify(`${round} · repetição`);
    if (!failure) return fix;
    if (ctx.signal.aborted) throw new Cancelled();
    if (fix >= config.limits.fixes) {
      throw new StepFailure(`${failure.label} continua falhando depois de ${config.limits.fixes} correções`, {
        file: failure.file,
        tail: failure.tail,
      });
    }
    const item = monitor.item(`fix-${fix + 1}`, `Correção ${fix + 1} de ${config.limits.fixes} (Claude)`);
    monitor.count('fixes');
    const paths = [...config.scope, `openspec/changes/${name}`];
    const before = snapshot(ctx.paths.root, paths);
    await claude(
      ctx,
      `corrigir-${moment === 'baseline' ? 'partida' : 'entrega'}-${fix + 1}`,
      buildPrompt('corrigir', {
        ...ctx.values,
        ...guidance,
        TENTATIVA: fix + 1,
        MAX: config.limits.fixes,
        COMANDO: failure.command,
        ERRO: failure.tail.join('\n'),
      }),
    );
    const refused = disablements(before, snapshot(ctx.paths.root, paths));
    if (refused.length) {
      item.failed('recusada: desligava verificações');
      throw new NeedsHuman(
        `a correção ${fix + 1} da verificação desligou verificações e foi recusada`,
        `revise e desfaça estas mudanças, depois continue: ${refused.slice(0, 3).join('; ')}${refused.length > 3 ? '…' : ''}`,
        { tail: refused },
      );
    }
    item.ok('aplicada; verificando de novo');
  }
}
