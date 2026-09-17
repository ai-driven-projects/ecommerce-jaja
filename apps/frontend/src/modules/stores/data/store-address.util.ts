/**
 * Cidade e UF a partir do endereço de referência da loja.
 *
 * PALIATIVO: o cadastro de loja guarda o endereço em texto livre, sem cidade e
 * UF estruturadas. O seed termina o endereço em `<Cidade>/<UF>`
 * ("Avenida Paulista, 2073 – Conjunto Nacional, Bela Vista, São Paulo/SP"), e é
 * só esse trecho final que lemos aqui, para pré-preencher cidade e UF nos
 * formulários de entrega. Quando a loja tiver cidade e UF como campos próprios,
 * esta função sai e os dados vêm da API.
 */

/** Cidade e UF lidas do endereço da loja. */
export type StorePlace = {
  city: string;
  state: string;
};

/** Sigla de UF: duas letras, sem acento. */
const PLACE_PATTERN = /(?:^|[,–\-|])\s*([^,–\-|/]+?)\s*\/\s*([A-Za-z]{2})\s*$/;

/**
 * Lê `<Cidade>/<UF>` do fim do endereço da loja:
 * `"Avenida Rio Branco, 156 – Centro, Rio de Janeiro/RJ"` → `{ city: 'Rio de Janeiro', state: 'RJ' }`.
 * Endereço vazio, ausente ou fora desse formato devolve `null`, e os campos
 * ficam vazios (nunca um valor chutado).
 */
export function storePlaceOf(address: string | null | undefined): StorePlace | null {
  const match = PLACE_PATTERN.exec((address ?? '').trim());
  if (!match) return null;

  const city = match[1].trim();
  if (city === '') return null;

  return { city, state: match[2].toUpperCase() };
}

/** `"São Paulo/SP"` para exibição; `null` sem cidade e UF conhecidas. */
export function formatStorePlace(place: StorePlace | null): string | null {
  return place ? `${place.city}/${place.state}` : null;
}
