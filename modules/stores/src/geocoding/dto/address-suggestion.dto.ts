// Address suggested for a point on the map (reverse geocoding).
// - `latitude`/`longitude`: the point that was **queried**, in decimal degrees
//   rounded to 6 places, and not the coordinates of the provider's result: the
//   marker placed by the user is the truth, the suggestion only describes it.
// - `formattedAddress`: the full address returned by the provider.
// - `zipCode`, `street`, `number`, `neighborhood`, `city` and `state`: `null`
//   when the provider does not return the component or it is not in the
//   expected format. `zipCode` has only the 8 digits (no dash; an incomplete CEP
//   becomes `null`) and `state` is the 2-letter uppercase UF.
// - `source`: whether the map provider answered (`google`) or the fixed
//   simulated address was used (`mock`).
export interface AddressSuggestionDTO {
  latitude: number
  longitude: number
  formattedAddress: string
  zipCode: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  source: 'google' | 'mock'
}
