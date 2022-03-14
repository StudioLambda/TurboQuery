import { expect, it } from 'vitest'
import { createTurboCache } from '../src/cache'

it.concurrent('can create a cache', async () => {
  const cache = createTurboCache()

  expect(cache).not.toBeNull()
})

it.concurrent('can set and get items from a cache', async () => {
  const cache = createTurboCache()

  cache.set('foo', 10)

  expect(cache.get('foo')).toBe(10)
})

it.concurrent('can check items in a cache', async () => {
  const cache = createTurboCache()

  cache.set('foo', 10)

  expect(cache.has('foo')).toBeTruthy()
})

it.concurrent('can remove items from a cache', async () => {
  const cache = createTurboCache()

  cache.set('foo', 10)
  cache.remove('foo')

  expect(cache.has('foo')).toBeFalsy()
})

it.concurrent('can clear all items from a cache', async () => {
  const cache = createTurboCache()

  cache.set('foo', 10)
  cache.set('bar', 20)
  cache.clear()

  expect(cache.has('foo')).toBeFalsy()
  expect(cache.has('bar')).toBeFalsy()
})

it.concurrent('can throws when no item is found on a cache', async () => {
  const cache = createTurboCache()

  expect(() => cache.get('foo')).toThrowError()
})

it.concurrent('can read all keys from a cache', async () => {
  const cache = createTurboCache()

  cache.set('foo', 10)
  cache.set('bar', 20)

  expect(cache.keys()).toContain('foo')
  expect(cache.keys()).toContain('bar')
})
