import { RandomSource } from '../../../src/load-test'

// A random source that repeats `values` in a loop, so each test knows exactly
// what is drawn.
export function sequenceRandom(values: number[]): RandomSource {
  let position = 0
  return () => {
    const value = values[position % values.length]!
    position++
    return value
  }
}
