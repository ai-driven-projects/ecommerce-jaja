// Coordinates found for an address, in decimal degrees rounded to 6 places.
// `source` tells whether the map provider answered (`google`) or the fixed
// simulated point was used (`mock`).
export interface GeocodingResultDTO {
  latitude: number
  longitude: number
  formattedAddress: string
  source: 'google' | 'mock'
}
