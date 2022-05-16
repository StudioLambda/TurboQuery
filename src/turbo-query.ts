export * from './cache'
export * from './events'
export * from './query'

import { createTurboQuery } from './query'

export const { query, subscribe, mutate, configure, abort, forget, keys, expiration, hydrate } =
  createTurboQuery()
