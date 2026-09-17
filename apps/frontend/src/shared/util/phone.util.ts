/** Só os dígitos do texto (`"529.982.247-25"` → `"52998224725"`). */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Telefone com DDD: `(11) 99999-9999` com 11 dígitos e `(11) 9999-9999` com
 * 10. Aceita texto parcial (máscara durante a digitação); acima de 11 dígitos
 * (a API aceita até 15) devolve só os dígitos, sem máscara. Vazio devolve `''`:
 * quem exibe decide o texto de ausência (ex.: "—").
 */
export function formatPhone(value: string | null | undefined): string {
  const digits = onlyDigits(value);
  if (digits.length > 11) return digits;
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${areaCode}) ${number}`;

  const split = number.length === 9 ? 5 : 4;
  return `(${areaCode}) ${number.slice(0, split)}-${number.slice(split)}`;
}
