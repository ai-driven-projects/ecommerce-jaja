import fs from 'node:fs';
import { useCallback, useEffect, useState } from 'react';
import { readControl } from '../../loops/control.js';
import { mtime, readJson } from '../../loops/files.js';
import { liveLock } from '../../loops/lock.js';
import {
  effectiveStatus,
  type LoopListItem,
  listLoops,
  loopPaths,
  normalizeLoop,
  planDivergences,
} from '../../loops/loops.js';
import { parsePlan, type Plan } from '../../loops/plan.js';
import type { Control, Live, Loop, LoopStatus } from '../../loops/types.js';

/** Intervalo de leitura dos arquivos do loop: a tela nunca fala com o vigia, só lê o que ele grava. */
export const READ_INTERVAL_MS = 1000;

export interface LoopState {
  loop?: Loop;
  error?: string;
  live?: Live;
  control: Control;
  watcher: number | null;
  status?: LoopStatus;
  plan?: Plan;
  divergences: string[];
}

type Cache = Map<string, { mtime: number; value: unknown }>;

/** Lê o arquivo só se ele mudou desde a última leitura (a tela relê a cada segundo). */
function readIfChanged<T>(cache: Cache, file: string, read: () => T): T | undefined {
  const m = mtime(file);
  if (!m) return undefined;
  const previous = cache.get(file);
  if (previous && previous.mtime === m) return previous.value as T;
  const value = read();
  cache.set(file, { mtime: m, value });
  return value;
}

export function readLoopState(name: string, cache: Cache = new Map()): LoopState {
  const paths = loopPaths(name);
  const watcher = liveLock(paths.lock);
  const state: LoopState = { control: readControl(paths), watcher, divergences: [] };
  try {
    const loop = readIfChanged(cache, paths.loop, () => {
      const read = readJson(paths.loop);
      if (!read.ok) throw new Error(read.error === 'missing' ? 'loop.json não encontrado' : 'loop.json inválido');
      return normalizeLoop(read.value, name);
    });
    if (!loop) throw new Error('loop.json não encontrado');
    state.loop = loop;
    state.status = effectiveStatus(loop.status, watcher !== null);
  } catch (error) {
    // uma leitura no meio de uma gravação manual: mantém o último estado bom
    const previous = cache.get(paths.loop)?.value as Loop | undefined;
    if (previous) {
      state.loop = previous;
      state.status = effectiveStatus(previous.status, watcher !== null);
    } else state.error = error instanceof Error ? error.message : String(error);
  }
  const live = readIfChanged(cache, paths.live, () => {
    const read = readJson<Live>(paths.live);
    return read.ok ? read.value : undefined;
  });
  // o retrato ao vivo só vale enquanto o vigia vive
  if (watcher) state.live = live;
  try {
    state.plan = readIfChanged(cache, paths.plan, () => parsePlan(fs.readFileSync(paths.plan, 'utf8')));
  } catch {
    state.plan = undefined;
  }
  if (state.loop && state.plan && state.loop.status !== 'draft')
    state.divergences = planDivergences(state.loop, state.plan);
  return state;
}

/** O estado de um loop, relido dos arquivos a cada segundo. */
export function useLoopState(name: string): [LoopState, () => void] {
  const [cache] = useState<Cache>(() => new Map());
  const [state, setState] = useState(() => readLoopState(name, cache));
  const reread = useCallback(() => setState(readLoopState(name, cache)), [name, cache]);
  useEffect(() => {
    const timer = setInterval(reread, READ_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reread]);
  return [state, reread];
}

/** Todos os loops do projeto, relidos a cada segundo. */
export function useLoopList(): [LoopListItem[], () => void] {
  const [items, setItems] = useState(() => listLoops());
  const reread = useCallback(() => setItems(listLoops()), []);
  useEffect(() => {
    const timer = setInterval(reread, READ_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reread]);
  return [items, reread];
}

/** A hora atual, atualizada a cada `ms` (tempo ao vivo, cronômetros). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
