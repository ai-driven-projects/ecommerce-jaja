/** Duração para humanos: `45s`, `23min`, `1h23min`. */
export function longDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}min`;
}

/** `US$ 5,50` */
export const money = (usd: number) => `US$ ${usd.toFixed(2).replace('.', ',')}`;

export const clock = (ts: number) => new Date(ts).toTimeString().slice(0, 8);

/** `hhmmss` para nomes de arquivo. */
export const stamp = (ts = Date.now()) => clock(ts).replace(/:/g, '');

/** Corta em uma linha, com reticências. */
export function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1))}…` : t;
}

/** "feat(backend): algo" → "algo" (o prefixo do commit é do script). */
export const withoutCommitPrefix = (title: string) => title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').trim();

/** "feat(backend)" → "fix(backend)": o commit de correção usa o mesmo escopo. */
export const fixPrefix = (prefix: string) => prefix.replace(/^[a-z]+/, 'fix');

export const twoDigits = (n: number) => String(n).padStart(2, '0');

/** "Título do Assunto!" → "titulo-do-assunto" */
export function toKebab(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
