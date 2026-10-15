import fs from 'node:fs';
import path from 'node:path';

/**
 * Grava sem deixar o arquivo pela metade: escreve num temporário, força o disco
 * e renomeia. Quem lê ao mesmo tempo vê a versão anterior inteira ou a nova inteira.
 */
export function writeAtomic(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(temp, 'w');
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
}

export const writeJson = (file: string, value: unknown) => writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);

export type JsonRead<T> = { ok: true; value: T } | { ok: false; error: 'missing' | 'invalid'; detail?: string };

/** Lê um JSON sem lançar: arquivo ausente e conteúdo inválido viram erro tipado. */
export function readJson<T>(file: string): JsonRead<T> {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { ok: false, error: 'missing' };
  }
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error: 'invalid', detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Acrescenta uma linha (cria a pasta se preciso). Nunca lança: log não pode derrubar o loop. */
export function appendLine(file: string, text: string): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
  } catch {
    // log perdido não para o loop
  }
}

/**
 * As últimas linhas de um arquivo, lendo no máximo `bytes` do fim. Arquivos de
 * log crescem sem limite; a tela nunca carrega um inteiro na memória.
 */
export function readTail(file: string, bytes = 512 * 1024): string[] {
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return [];
  }
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    const lines = buffer.toString('utf8').split('\n');
    // começando no meio do arquivo, a primeira linha está cortada
    if (start > 0) lines.shift();
    if (lines.at(-1) === '') lines.pop();
    return lines;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * As linhas completas escritas desde `offset` (em bytes) e o novo offset, para
 * acompanhar um arquivo que só cresce. Uma linha ainda pela metade fica para a próxima leitura.
 */
export function readFrom(file: string, offset: number): { lines: string[]; offset: number } {
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return { lines: [], offset };
  }
  try {
    const size = fs.fstatSync(fd).size;
    const start = size < offset ? 0 : offset;
    if (size === start) return { lines: [], offset: start };
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    const text = buffer.toString('utf8');
    const lastBreak = text.lastIndexOf('\n');
    if (lastBreak < 0) return { lines: [], offset: start };
    return {
      lines: text.slice(0, lastBreak).split('\n'),
      offset: start + Buffer.byteLength(text.slice(0, lastBreak + 1)),
    };
  } finally {
    fs.closeSync(fd);
  }
}

export function fileSize(file: string): number {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/** Data de modificação, ou 0 se o arquivo não existe. */
export function mtime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}
