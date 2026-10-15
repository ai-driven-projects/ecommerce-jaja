export interface TypedKey {
  backspace?: boolean;
  delete?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  return?: boolean;
  tab?: boolean;
  escape?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
}

const isNavigation = (key: TypedKey) =>
  key.escape || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.tab;

/**
 * Aplica ao texto o que chegou do teclado. O terminal pode entregar várias
 * teclas num bloco só (digitação rápida, backspace segurado).
 */
export function applyTyping(text: string, input: string, key: TypedKey): string {
  if (key.backspace || key.delete) return text.slice(0, -1);
  if (key.ctrl || key.meta || key.return || isNavigation(key) || !input) return text;
  let result = text;
  for (const ch of input) {
    if (ch === '\x7f' || ch === '\b') result = result.slice(0, -1);
    else if (ch >= ' ') result += ch;
  }
  return result;
}

/**
 * Como `applyTyping`, mas aceitando várias linhas: enter quebra a linha e um
 * texto colado mantém as quebras.
 */
export function applyMultilineTyping(text: string, input: string, key: TypedKey): string {
  if (key.return) return `${text}\n`;
  if (key.backspace || key.delete) return text.slice(0, -1);
  if (key.ctrl || key.meta || isNavigation(key) || !input) return text;
  return appendPasted(text, input);
}

/** Acrescenta um texto colado, mantendo as quebras de linha e trocando tabs por espaços. */
export function appendPasted(text: string, pasted: string): string {
  let result = text;
  for (const ch of pasted.replace(/\r\n?/g, '\n')) {
    if (ch === '\x7f' || ch === '\b') result = result.slice(0, -1);
    else if (ch === '\n') result += ch;
    else if (ch === '\t') result += '  ';
    else if (ch >= ' ') result += ch;
  }
  return result;
}
