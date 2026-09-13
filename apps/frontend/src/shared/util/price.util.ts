/**
 * Formata centavos no padrão do design: `R$ 12,90`.
 * Prefixo, espaço, vírgula decimal e duas casas; milhar com ponto.
 * Exemplos: 1290 → `R$ 12,90` · 50 → `R$ 0,50` · 100000 → `R$ 1.000,00`.
 */
export function formatPrice(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safeCents < 0 ? '-' : '';
  const absolute = Math.abs(safeCents);
  const reais = Math.floor(absolute / 100).toLocaleString('pt-BR');
  const centavos = String(absolute % 100).padStart(2, '0');

  return `${sign}R$ ${reais},${centavos}`;
}
