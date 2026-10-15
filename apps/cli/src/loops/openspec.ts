import fs from 'node:fs';
import path from 'node:path';

export interface Tasks {
  done: number;
  total: number;
  open: string[];
}

const TASK = /^\s*- \[( |x|X)\]\s*(.*)$/;

/** Conta as tarefas de um tasks.md ("- [ ]" abertas, "- [x]" feitas). */
export function countTasks(text: string): Tasks {
  const open: string[] = [];
  let done = 0;
  for (const line of text.split('\n')) {
    const match = line.match(TASK);
    if (!match) continue;
    if (match[1] === ' ') open.push((match[2] ?? '').trim());
    else done++;
  }
  return { done, total: done + open.length, open };
}

export interface TaskGroup {
  title: string;
  done: number;
  open: string[];
}

/** Separa o tasks.md pelos grupos "## …". Tarefas antes do primeiro grupo ficam num grupo sem título. */
export function taskGroups(text: string): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let current: TaskGroup | undefined;
  for (const line of text.split('\n')) {
    const title = line.match(/^##\s+(.+)$/);
    if (title) {
      current = { title: (title[1] ?? '').trim(), done: 0, open: [] };
      groups.push(current);
      continue;
    }
    const match = line.match(TASK);
    if (!match) continue;
    if (!current) {
      current = { title: '', done: 0, open: [] };
      groups.push(current);
    }
    if (match[1] === ' ') current.open.push((match[2] ?? '').trim());
    else current.done++;
  }
  return groups;
}

/**
 * Junta grupos seguidos com tarefas abertas em lotes de até `max` tarefas, um
 * lote por sessão do Claude. Um grupo nunca é partido: um grupo maior que `max`
 * vira um lote sozinho.
 */
export function taskBatches(groups: TaskGroup[], max: number): TaskGroup[][] {
  const batches: TaskGroup[][] = [];
  let batch: TaskGroup[] = [];
  let size = 0;
  for (const group of groups.filter((g) => g.open.length)) {
    if (batch.length && size + group.open.length > max) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(group);
    size += group.open.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export const changeDir = (root: string, name: string) => path.join(root, 'openspec/changes', name);

export function changeTaskGroups(root: string, name: string): TaskGroup[] {
  const file = path.join(changeDir(root, name), 'tasks.md');
  return fs.existsSync(file) ? taskGroups(fs.readFileSync(file, 'utf8')) : [];
}

export function changeTasks(root: string, name: string): Tasks | null {
  const file = path.join(changeDir(root, name), 'tasks.md');
  return fs.existsSync(file) ? countTasks(fs.readFileSync(file, 'utf8')) : null;
}

export interface Artifacts {
  proposal: boolean;
  design: boolean;
  specs: boolean;
  tasks: boolean;
}

/** Quais artefatos da change já existem. */
export function artifacts(root: string, name: string): Artifacts {
  const dir = changeDir(root, name);
  const specs = path.join(dir, 'specs');
  return {
    proposal: fs.existsSync(path.join(dir, 'proposal.md')),
    design: fs.existsSync(path.join(dir, 'design.md')),
    specs: fs.existsSync(specs) && fs.readdirSync(specs).length > 0,
    tasks: fs.existsSync(path.join(dir, 'tasks.md')),
  };
}

export function describeArtifacts(a: Artifacts): string {
  return Object.entries(a)
    .map(([key, present]) => `${present ? '✓' : '·'} ${key}`)
    .join('  ');
}

export const subdirs = (root: string, relative: string) => {
  const dir = path.join(root, relative);
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
};

/** `openspec/changes/archive/<data>-<nome>` (a mais recente), relativo à raiz. */
export function archivedDir(root: string, name: string): string | undefined {
  return subdirs(root, 'openspec/changes/archive')
    .filter((dir) => dir.endsWith(`-${name}`) && /^\d{4}-\d{2}-\d{2}-/.test(dir) && dir.slice(11) === name)
    .sort()
    .map((dir) => `openspec/changes/archive/${dir}`)
    .pop();
}

/** A change existe no OpenSpec, aberta ou arquivada. */
export const changeExists = (root: string, name: string) =>
  fs.existsSync(changeDir(root, name)) || !!archivedDir(root, name);

/** A primeira frase do "## Why" do proposal.md (ou a primeira linha de texto), para listas. */
export function proposalSummary(root: string, name: string): string {
  const file = path.join(changeDir(root, name), 'proposal.md');
  if (!fs.existsSync(file)) return '';
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const why = lines.findIndex((line) => /^##\s+(why|por ?que|motiva)/i.test(line.trim()));
  const text = lines.slice(why + 1).find((line) => line.trim() && !line.trim().startsWith('#'));
  return (text ?? '').replace(/^[-*]\s+/, '').trim();
}

export interface PendingSpec {
  name: string;
  tasks: Tasks | null;
  summary: string;
}

/** Changes abertas (não arquivadas) com proposal ou tasks: as specs que um loop novo pode aplicar. */
export function pendingSpecs(root: string): PendingSpec[] {
  return subdirs(root, 'openspec/changes')
    .filter((name) => name !== 'archive' && !name.startsWith('.'))
    .filter((name) => {
      const a = artifacts(root, name);
      return a.proposal || a.tasks;
    })
    .sort()
    .map((name) => ({ name, tasks: changeTasks(root, name), summary: proposalSummary(root, name) }));
}
