import fs from 'node:fs';
import path from 'node:path';
import { CLI_DIR, ENGINE_DIR } from './config.js';

type Values = Record<string, string | number>;

/** Troca cada {{CHAVE}} pelo valor correspondente; chaves sem valor ficam como estão. */
export function fill(text: string, values: Values): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (original, key: string) =>
    key in values ? String(values[key]) : original,
  );
}

/**
 * A pasta dos prompts: ao lado do motor em `src/loops` e, no binário compilado,
 * copiada para `dist/loops/prompts` pelo build (com o fonte como reserva).
 */
function promptsDir(): string {
  const candidates = [path.join(ENGINE_DIR, 'prompts'), path.join(CLI_DIR, 'src/loops/prompts')];
  return candidates.find((dir) => fs.existsSync(dir)) ?? (candidates[0] as string);
}

/** Lê prompts/<nome>.md e preenche. */
export function buildPrompt(name: string, values: Values = {}): string {
  return fill(fs.readFileSync(path.join(promptsDir(), `${name}.md`), 'utf8'), values);
}

/** Regras gerais de autonomia + as regras do plano do loop. */
export function buildSystem(values: Values, loopRules: string): string {
  const general = buildPrompt('sistema', values);
  return loopRules.trim() ? `${general.trimEnd()}\n\n## Regras deste loop\n\n${loopRules.trim()}\n` : general;
}

/** O Claude só escreve o briefing: etapa, nome e fase vêm do plano e são preenchidos pelo script. */
export const BRIEFING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    comparison: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['title', 'comparison', 'description'],
};

/** O propor estuda a etapa sozinho: devolve só o título do commit e o que viu do ponto de partida. */
export const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    comparison: { type: 'string' },
  },
  required: ['title', 'comparison'],
};

const CONFIG_PROPERTIES = {
  scope: { type: 'array', items: { type: 'string' } },
  commitPrefix: { type: 'string' },
  requiredCommands: { type: 'array', items: { type: 'string' } },
  checks: {
    type: 'array',
    items: {
      type: 'object',
      properties: { label: { type: 'string' }, command: { type: 'string' }, dir: { type: 'string' } },
      required: ['label', 'command', 'dir'],
    },
  },
};

export const PLANNING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    rules: { type: 'string' },
    outOfScope: { type: 'string' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          stages: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, subject: { type: 'string' }, description: { type: 'string' } },
              required: ['title', 'subject', 'description'],
            },
          },
        },
        required: ['name', 'stages'],
      },
    },
    ...CONFIG_PROPERTIES,
  },
  required: ['title', 'rules', 'outOfScope', 'phases', 'scope', 'commitPrefix', 'requiredCommands', 'checks'],
};

/** Loop a partir de specs existentes: as etapas vêm prontas, o Claude completa o resto do plano e a configuração. */
export const SPECS_PLANNING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    rules: { type: 'string' },
    outOfScope: { type: 'string' },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { change: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } },
        required: ['change', 'title', 'description'],
      },
    },
    ...CONFIG_PROPERTIES,
  },
  required: ['title', 'goal', 'rules', 'outOfScope', 'stages', 'scope', 'commitPrefix', 'requiredCommands', 'checks'],
};

/** Resposta da sessão de recuperação. O motor registra, mas quem decide é a pós-condição do passo. */
export const RECOVERY_SCHEMA = {
  type: 'object',
  properties: {
    resolved: { type: 'boolean' },
    cause: { type: 'string' },
    whatItDid: { type: 'string' },
    needsHuman: { type: 'boolean' },
    whatToDo: { type: 'string' },
  },
  required: ['resolved', 'cause', 'whatItDid', 'needsHuman', 'whatToDo'],
};
