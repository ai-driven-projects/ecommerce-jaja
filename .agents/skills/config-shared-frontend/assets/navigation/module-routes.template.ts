/**
 * TEMPLATE — {module-id}-routes.ts
 *
 * Crie um arquivo como este para cada módulo do projeto.
 * Renomeie o arquivo para ex: dashboard-routes.ts, clients-routes.ts, etc.
 * Substitua MODULE pelo prefixo do módulo em SCREAMING_SNAKE_CASE.
 * Substitua /module pela rota base real do módulo.
 */

// ── Rotas base ────────────────────────────────────────────────────────────────

export const MODULE_ROUTE = '/module';
export const MODULE_LIST_ROUTE = '/module/list'; // adicione sub-rotas estáticas conforme necessário

// ── Rotas de criação ──────────────────────────────────────────────────────────

export const MODULE_NEW_ROUTE = `${MODULE_ROUTE}/new`;

// ── Helpers de rota dinâmica ───────────────────────────────────────────────────

export function getModuleEditRoute(id: string) {
  return `${MODULE_ROUTE}/${id}/edit`;
}
