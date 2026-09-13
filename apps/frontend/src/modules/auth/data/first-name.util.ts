/** Primeiro nome de um nome completo, para saudações ("olá, Ana"). */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}
