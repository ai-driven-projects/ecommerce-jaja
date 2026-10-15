/** Marca a spec no fim da ordem ou, se já estava marcada, a tira e renumera as seguintes. */
export function toggleInOrder(order: string[], name: string): string[] {
  return order.includes(name) ? order.filter((n) => n !== name) : [...order, name];
}

/** Filtro por palavras (todas precisam aparecer), sem diferenciar maiúsculas, no nome ou no resumo. */
export function filterSpecs<T extends { name: string; summary: string }>(specs: T[], filter: string): T[] {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return specs;
  return specs.filter((spec) => {
    const text = `${spec.name} ${spec.summary}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
