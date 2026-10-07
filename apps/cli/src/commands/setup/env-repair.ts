/** Funções puras que completam um .env a partir do template, testáveis sem disco. */

const KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;
const SECRET_KEY = /(SECRET|TOKEN|PASSWORD|SALT)$/i;

/** Chaves de segredo (JWT_SECRET, *_TOKEN...) recebem um valor aleatório quando estão sem valor. */
export function isGeneratableSecret(key: string): boolean {
  return SECRET_KEY.test(key);
}

/**
 * Bloco do template que define `key`: a linha da chave mais os comentários logo acima dela
 * (até uma linha vazia ou outra chave), para a chave chegar ao .env já explicada.
 */
function templateBlock(templateLines: string[], key: string): string[] {
  const index = templateLines.findIndex((line) => KEY_LINE.exec(line)?.[1] === key);
  if (index === -1) return [];
  let start = index;
  while (start > 0 && templateLines[start - 1]?.trim().startsWith('#')) start -= 1;
  return templateLines.slice(start, index + 1);
}

/** Acrescenta ao final do .env as chaves que só existem no template, com os valores e comentários dele. */
export function appendMissingKeys(actualRaw: string, templateRaw: string, missing: string[]): string {
  if (missing.length === 0) return actualRaw;
  const templateLines = templateRaw.split(/\r?\n/);
  const blocks = missing.map((key) => templateBlock(templateLines, key).join('\n')).filter(Boolean);
  const base = actualRaw.replace(/\s*$/, '');
  return `${base}${base ? '\n\n' : ''}${blocks.join('\n\n')}\n`;
}

/** Troca o valor de `key` no .env (primeira ocorrência), preservando o resto do arquivo. */
export function setEnvValue(actualRaw: string, key: string, value: string): string {
  const lines = actualRaw.split(/\r?\n/);
  const index = lines.findIndex((line) => KEY_LINE.exec(line)?.[1] === key);
  if (index === -1) return actualRaw;
  lines[index] = `${key}="${value}"`;
  return lines.join('\n');
}
