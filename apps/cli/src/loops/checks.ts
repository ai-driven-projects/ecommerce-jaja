import fs from 'node:fs';
import path from 'node:path';
import { longDuration, stamp } from './format.js';
import type { Monitor } from './monitor.js';
import { run } from './process.js';
import type { Check } from './types.js';

export interface CheckFailure {
  label: string;
  command: string;
  file: string;
  tail: string[];
}

export const readableCommand = (check: Check) => `cd ${check.dir || '.'} && ${check.command.join(' ')}`;

/**
 * Roda cada verificação do loop em ordem e para na primeira que falhar. A saída
 * completa vai para `<dir>/<hhmmss>-<id>.log`; em memória fica só a cauda.
 */
export async function runChecks(
  checks: Check[],
  options: { root: string; dir: string; round: string; timeoutMs: number; monitor: Monitor; signal?: AbortSignal },
): Promise<CheckFailure | null> {
  const { monitor, round } = options;
  fs.mkdirSync(options.dir, { recursive: true });
  const items = checks.map((check) => monitor.item(`check-${check.id}`, check.label, 'pending', round));
  for (const [index, check] of checks.entries()) {
    const item = items[index];
    const file = path.join(options.dir, `${stamp()}-${check.id}.log`);
    const command = readableCommand(check);
    item?.running(round);
    monitor.log('command', command);
    const [executable = '', ...args] = check.command;
    const result = await run(executable, args, {
      cwd: path.join(options.root, check.dir || '.'),
      timeoutMs: options.timeoutMs,
      file,
      signal: options.signal,
      onLine: (line) => {
        if (line.trim()) monitor.log('output', line);
      },
    });
    monitor.count('checks');
    const ok = result.code === 0;
    monitor.event('check', {
      label: check.label,
      ok,
      round,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      file: path.relative(options.root, file),
    });
    if (ok) {
      item?.ok(`${longDuration(result.durationMs)} · ${round}`);
      continue;
    }
    item?.failed(
      result.timedOut
        ? `passou de ${Math.round(options.timeoutMs / 60_000)} min`
        : `código ${result.code} · ${path.relative(options.root, file)}`,
    );
    for (const next of items.slice(index + 1)) next.skipped('não rodou');
    return { label: check.label, command, file, tail: result.tail.filter((line) => line.trim()).slice(-80) };
  }
  return null;
}
