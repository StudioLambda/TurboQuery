import { it } from 'vitest'
import {
  query,
  subscribe,
  mutate,
  configure,
  abort,
  forget,
  keys,
  expiration,
  hydrate,
} from '../src/turbo-query'

it.concurrent('can import default instance methods', async ({ expect }) => {
  expect(query).not.toBeNull()
  expect(subscribe).not.toBeNull()
  expect(mutate).not.toBeNull()
  expect(configure).not.toBeNull()
  expect(abort).not.toBeNull()
  expect(forget).not.toBeNull()
  expect(keys).not.toBeNull()
  expect(expiration).not.toBeNull()
  expect(hydrate).not.toBeNull()
})
