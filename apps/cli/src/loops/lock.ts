import fs from 'node:fs';
import path from 'node:path';

export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: o processo existe, mas é de outro usuário
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export interface Lock {
  pid: number;
  start: string;
}

export function readLock(file: string): Lock | null {
  try {
    const lock = JSON.parse(fs.readFileSync(file, 'utf8')) as Lock;
    return Number.isInteger(lock.pid) ? lock : null;
  } catch {
    return null;
  }
}

/** Pid do vigia que segura a trava, ou null se não há trava ou ela venceu (pid morto). */
export function liveLock(file: string): number | null {
  const lock = readLock(file);
  return lock && pidAlive(lock.pid) ? lock.pid : null;
}

/** Pega a trava para este processo. Retorna o pid de quem já a segura, ou null se conseguiu. */
export function acquireLock(file: string, pid = process.pid): number | null {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const other = liveLock(file);
  if (other && other !== pid) return other;
  // trava vencida (vigia morto sem soltar) ou ausente
  fs.rmSync(file, { force: true });
  try {
    fs.writeFileSync(file, JSON.stringify({ pid, start: new Date().toISOString() }), { flag: 'wx' });
  } catch {
    // outro processo criou a trava entre a checagem e a escrita
    const winner = liveLock(file);
    if (winner && winner !== pid) return winner;
  }
  return null;
}

/** Solta a trava, só se for deste processo. */
export function releaseLock(file: string, pid = process.pid): void {
  if (readLock(file)?.pid === pid) fs.rmSync(file, { force: true });
}
