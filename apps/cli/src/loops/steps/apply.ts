import fs from 'node:fs';
import path from 'node:path';
import { oneLine } from '../format.js';
import { archivedDir, changeDir, changeTaskGroups, changeTasks, type TaskGroup, taskBatches } from '../openspec.js';
import { run } from '../process.js';
import { buildPrompt } from '../prompts.js';
import { claude, whilePending } from './common.js';
import { PauseRequested, type Step, StepFailure } from './context.js';
import { startEarlyProposal } from './early.js';

export const batchText = (batch: TaskGroup[]) =>
  batch
    .map(
      (group) =>
        `### ${group.title || '(tarefas sem grupo)'}\n\n${group.open.map((task) => `- [ ] ${task}`).join('\n')}`,
    )
    .join('\n\n');

export const apply: Step = {
  id: 'apply',
  success: 'openspec/changes/<change>/tasks.md existe e não tem nenhuma tarefa aberta (- [ ])',
  async postcondition(ctx) {
    const tasks = changeTasks(ctx.paths.root, ctx.stage.change);
    if (!tasks) return ['tasks.md não existe'];
    return tasks.open.length
      ? [
          `${tasks.open.length} tarefa(s) abertas: ${tasks.open
            .slice(0, 3)
            .map((task) => oneLine(task, 60))
            .join('; ')}`,
        ]
      : [];
  },
  async execute(ctx) {
    const root = ctx.paths.root;
    const name = ctx.stage.change;
    const { limits } = ctx.config;
    // a proposta da próxima etapa só depende da spec desta, já commitada: escreve em paralelo
    ctx.early ??= startEarlyProposal(ctx);
    const progress = ctx.monitor.item('tasks', 'Tarefas do tasks.md', 'running');
    const refresh = () => {
      const tasks = changeTasks(root, name);
      if (!tasks) return;
      ctx.monitor.tasks(tasks.done, tasks.total);
      progress.detail(
        `${tasks.done}/${tasks.total}${tasks.open[0] ? ` · próxima: ${oneLine(tasks.open[0], 60)}` : ''}`,
      );
    };
    refresh();

    // um lote de grupos do tasks.md por sessão, cada uma com contexto limpo;
    // na retomada, os grupos já concluídos (tarefas marcadas) não entram
    const tried = new Set<string>();
    const totalBatches = taskBatches(changeTaskGroups(root, name), limits.tasksPerSession).length;
    for (let number = 1; ; number++) {
      const batch = taskBatches(
        changeTaskGroups(root, name).filter((group) => !tried.has(group.title)),
        limits.tasksPerSession,
      )[0];
      if (!batch) break;
      if (ctx.pauseRequested()) throw new PauseRequested();
      batch.forEach((group) => tried.add(group.title));
      const inBatch = batch.reduce((n, group) => n + group.open.length, 0);
      const total = Math.max(totalBatches, number);
      const item = ctx.monitor.item(
        `session-${number}`,
        `Claude implementa o lote ${number} de ${total} · ${inBatch} tarefa(s), sessão nova`,
      );
      await whilePending(
        claude(
          ctx,
          `aplicar-lote-${number}`,
          buildPrompt('aplicar', { ...ctx.values, LOTE: number, TOTAL_LOTES: total, TAREFAS: batchText(batch) }),
        ),
        refresh,
      );
      item.ok(batch.map((group) => oneLine(group.title, 40)).join(' · '));
    }

    for (let round = 1; changeTasks(root, name)?.open.length; round++) {
      const open = changeTasks(root, name)?.open ?? [];
      if (round > limits.continuations) {
        progress.failed(`${open.length} tarefa(s) abertas`);
        throw new StepFailure(
          `ainda há ${open.length} tarefa(s) abertas depois de ${limits.continuations} continuações`,
          { tail: open },
        );
      }
      if (ctx.pauseRequested()) throw new PauseRequested();
      const item = ctx.monitor.item(
        `continuation-${round}`,
        `Continuação ${round} de ${limits.continuations} (Claude)`,
      );
      await whilePending(
        claude(
          ctx,
          `aplicar-continuacao-${round}`,
          buildPrompt('continuar', { ...ctx.values, PENDENTES: open.map((task) => `- [ ] ${task}`).join('\n') }),
        ),
        refresh,
      );
      item.ok();
    }
    const tasks = changeTasks(root, name);
    if (!tasks) throw new StepFailure(`openspec/changes/${name}/tasks.md não existe`);
    progress.ok(`${tasks.done}/${tasks.total} concluídas`);
  },
};

export const archive: Step = {
  id: 'archive',
  success: 'a change está em openspec/changes/archive/<data>-<change> e não existe mais em openspec/changes/<change>',
  async postcondition(ctx) {
    const problems: string[] = [];
    if (!archivedDir(ctx.paths.root, ctx.stage.change)) problems.push('a change não está em openspec/changes/archive/');
    if (fs.existsSync(changeDir(ctx.paths.root, ctx.stage.change)))
      problems.push('a change ainda existe em openspec/changes/');
    return problems;
  },
  async execute(ctx) {
    const root = ctx.paths.root;
    const name = ctx.stage.change;
    if (fs.existsSync(changeDir(root, name))) {
      const item = ctx.monitor.item('session', 'Claude arquiva e sincroniza specs (/opsx:archive)');
      await claude(ctx, 'arquivar', buildPrompt('arquivar', ctx.values));
      item.ok();
    }
    if (fs.existsSync(changeDir(root, name))) {
      const cli = ctx.monitor.item('cli', 'openspec archive -y (reserva)');
      const result = await run('openspec', ['archive', name, '-y'], {
        cwd: root,
        timeoutMs: 120_000,
        signal: ctx.signal,
        onLine: (line) => ctx.monitor.log('output', line),
      });
      if (result.code !== 0) {
        cli.failed();
        throw new StepFailure('openspec archive falhou', { tail: result.tail });
      }
      cli.ok();
    }
    const target = archivedDir(root, name);
    if (!target) throw new StepFailure(`não encontrei ${name} em openspec/changes/archive`);
    ctx.monitor.item('archived', 'Change arquivada', 'ok', target);
    const capabilities = fs.existsSync(path.join(root, target, 'specs'))
      ? fs.readdirSync(path.join(root, target, 'specs'))
      : [];
    const missing = capabilities.filter(
      (capability) => !fs.existsSync(path.join(root, 'openspec/specs', capability, 'spec.md')),
    );
    if (missing.length)
      ctx.monitor.item('specs', 'Specs principais', 'warn', `não sincronizadas: ${missing.join(', ')}`);
    else
      ctx.monitor.item(
        'specs',
        'Specs principais',
        'ok',
        capabilities.length ? capabilities.join(', ') : 'nenhuma delta spec',
      );
  },
};
