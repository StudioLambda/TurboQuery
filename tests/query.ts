import { it } from 'vitest'
import { createTurboQuery, TurboFetcherAdditional } from '../src/query'
import { createTurboCache } from '../src/cache'
import { createTurboEvents } from '../src/events'

it.concurrent('can create a turbo query', async ({ expect }) => {
  const turboquery = createTurboQuery()

  expect(turboquery).not.toBeNull()
})

it.concurrent('can fails to query without fetcher', async ({ expect }) => {
  const { query } = createTurboQuery()

  await expect(() => query<string>('example-key')).rejects.toThrowError()
})

it.concurrent('can query resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher })

  const resource = await query<string>('example-key')

  expect(resource).toBe('example')
})

it.concurrent('can fetch expired resources while returning stale', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 100 })

  await query<string>('example-key')
  await new Promise((r) => setTimeout(r, 100))
  const resource = await query<string>('example-key')

  expect(resource).toBe('example')
})

it.concurrent('can fetch expired resources while not returning stale', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 100 })

  await query<string>('example-key')
  await new Promise((r) => setTimeout(r, 100))
  const resource = await query<string>('example-key', { stale: false })

  expect(resource).toBe('example')
})

it.concurrent('returns the same promise when resources are resolving', async ({ expect }) => {
  let times = 0
  async function fetcher() {
    await new Promise((r) => setTimeout(r, 200))
    times++
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher })

  query<string>('example-key')
  await query<string>('example-key')

  expect(times).toBe(1)
})

it.concurrent('does respect dedupe interval of resources', async ({ expect }) => {
  let times = 0
  async function fetcher() {
    times++
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 0 })

  await query<string>('example-key')
  await new Promise((r) => setTimeout(r, 100))
  await query<string>('example-key')

  expect(times).toBe(2)
})

it.concurrent('does respect dedupe interval of resources 2', async ({ expect }) => {
  let times = 0
  async function fetcher() {
    times++
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 100 })

  await query<string>('example-key')
  await query<string>('example-key')

  expect(times).toBe(1)
})

it.concurrent('can subscribe to refetchings on resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, subscribe } = createTurboQuery({ fetcher, expiration: () => 0 })

  let result: string | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'refetching', async function (item) {
    result = await item
  })
  await query('example-key', { fetcher })
  unsubscribe()

  expect(result).toBe('example')
})

it.concurrent('can subscribe to refetchings on pending resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, subscribe } = createTurboQuery({ fetcher, expiration: () => 0 })
  const r = query('example-key', { fetcher })

  let result: string | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'refetching', async function (item) {
    result = await item
  })
  await r
  unsubscribe()

  expect(result).toBe('example')
})

it.concurrent('can subscribe to resolutions on resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, subscribe } = createTurboQuery({ fetcher, expiration: () => 0 })

  let result: string | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'resolved', async function (item) {
    result = item
  })

  await query('example-key', { fetcher })
  unsubscribe()
  expect(result).toBe('example')
})

it.concurrent('can subscribe to mutations on resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, subscribe, mutate } = createTurboQuery({ fetcher })

  const current = await query('example-key', { fetcher })

  expect(current).toBe('example')

  let result: string | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'mutated', async function (item) {
    result = item
  })

  mutate('example-key', 'mutated-example')
  unsubscribe()

  expect(result).toBe('mutated-example')
})

it.concurrent('can mutate non-existing cache keys when using a fn', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, mutate } = createTurboQuery({ fetcher })

  const current = await query('example-key', { fetcher })

  expect(current).toBe('example')

  mutate('example-key-2', () => 'mutated-example')

  const result = await query('example-key-2', { fetcher })

  expect(result).toBe('mutated-example')
})

it.concurrent('can subscribe to mutations on resources 2', async ({ expect }) => {
  async function fetcher() {
    return 1
  }

  const { query, subscribe, mutate } = createTurboQuery({ fetcher })

  const current = await query('example-key', { fetcher })

  expect(current).toBe(1)

  let result: number | undefined = undefined
  const unsubscribe = subscribe<number>('example-key', 'mutated', async function (item) {
    result = item
  })

  mutate<number>('example-key', (old) => (old ?? 0) + 1)
  unsubscribe()

  expect(result).toBe(2)
})

it.concurrent('can subscribe to aborts on resources', async ({ expect }) => {
  function fetcher(_key: string, { signal }: TurboFetcherAdditional) {
    return new Promise(function (resolve, reject) {
      signal.addEventListener('abort', function () {
        reject('aborted')
      })
      new Promise((r) => setTimeout(r, 200)).then(function () {
        resolve('example')
      })
    })
  }

  const { query, subscribe, abort } = createTurboQuery({ fetcher, expiration: () => 0 })

  let result: Promise<string> | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'aborted', async function (item) {
    result = item
  })

  const r = query('example-key', { fetcher })
  abort()
  unsubscribe()

  await expect(() => r).rejects.toThrowError('aborted')
  await expect(() => result).rejects.toThrowError('aborted')
})

it.concurrent('can subscribe to forgets on resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, subscribe, forget, keys } = createTurboQuery({ fetcher })

  const current = await query('example-key', { fetcher })

  expect(current).toBe('example')

  let result: string | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'forgotten', async function (item) {
    result = item
  })

  forget('example-key')
  unsubscribe()

  expect(result).toBe('example')
  expect(keys('items')).toHaveLength(0)
})

it.concurrent('can subscribe to hydrates on resources', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, subscribe, hydrate, keys } = createTurboQuery({ fetcher })

  const current = await query('example-key', { fetcher })

  expect(current).toBe('example')

  let result: string | undefined = undefined
  const unsubscribe = subscribe<string>('example-key', 'hydrated', async function (item) {
    result = item
  })

  hydrate('example-key', 'hydrated-example')
  unsubscribe()

  expect(result).toBe('hydrated-example')
  expect(keys('items')).toHaveLength(1)
})

it.concurrent('can reconfigure turbo query', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, configure } = createTurboQuery({ fetcher })

  configure({
    itemsCache: createTurboCache(),
    resolversCache: createTurboCache(),
    events: createTurboEvents(),
    expiration() {
      return 5000
    },
    stale: false,
    async fetcher() {
      return 'different'
    },
    removeOnError: true,
    fresh: true,
  })

  const result = await query('some-key')

  expect(result).toBe('different')
})

it.concurrent('can reconfigure turbo query 2', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, configure } = createTurboQuery({ fetcher })

  configure()

  const result = await query('some-key')

  expect(result).toBe('example')
})

it.concurrent('can abort turbo query', async ({ expect }) => {
  function fetcher(_key: string, { signal }: TurboFetcherAdditional) {
    return new Promise(function (resolve, reject) {
      signal.addEventListener('abort', function () {
        reject('aborted')
      })
      new Promise((r) => setTimeout(r, 200)).then(function () {
        resolve('example')
      })
    })
  }

  const { query, abort } = createTurboQuery({ fetcher })
  const result = query<string>('example-key')
  abort('example-key')

  await expect(() => result).rejects.toThrowError('aborted')
})

it.concurrent('can abort turbo query 2', async ({ expect }) => {
  function fetcher(_key: string, { signal }: TurboFetcherAdditional) {
    return new Promise(function (resolve, reject) {
      signal.addEventListener('abort', function () {
        reject('aborted')
      })
      new Promise((r) => setTimeout(r, 200)).then(function () {
        resolve('example')
      })
    })
  }

  const { query, abort } = createTurboQuery({ fetcher })
  const result = query<string>('example-key')
  abort(['example-key'])

  await expect(() => result).rejects.toThrowError('aborted')
})

it.concurrent('can abort turbo query 3', async ({ expect }) => {
  function fetcher(_key: string, { signal }: TurboFetcherAdditional) {
    return new Promise(function (resolve, reject) {
      signal.addEventListener('abort', function () {
        reject('aborted')
      })
      new Promise((r) => setTimeout(r, 200)).then(function () {
        resolve('example')
      })
    })
  }

  const { query, abort } = createTurboQuery({ fetcher })
  const result = query<string>('example-key')
  abort()

  await expect(() => result).rejects.toThrowError('aborted')
})

it.concurrent('can get the item keys of a turbo query', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, keys } = createTurboQuery({ fetcher })
  await query<string>('foo')
  await query<string>('bar')
  const items = keys('items')

  expect(items).toHaveLength(2)
  expect(items).toContain('foo')
  expect(items).toContain('bar')
})

it.concurrent('can get the resolvers keys of a turbo query', async ({ expect }) => {
  async function fetcher() {
    await new Promise((r) => setTimeout(r, 250))
    return 'example'
  }

  const { query, keys } = createTurboQuery({ fetcher })
  query<string>('foo')
  query<string>('bar')
  const resolvers = keys('resolvers')

  expect(resolvers).toHaveLength(2)
  expect(resolvers).toContain('foo')
  expect(resolvers).toContain('bar')
})

it.concurrent('can forget a turbo query key', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, forget, keys } = createTurboQuery({ fetcher })
  await query<string>('example-key')

  expect(keys('items')).toContain('example-key')
  forget('example-key')
  expect(keys('items')).toHaveLength(0)
})

it.concurrent('can forget a turbo query key 2', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, forget, keys } = createTurboQuery({ fetcher })
  await query<string>('example-key')

  expect(keys('items')).toContain('example-key')
  forget(['example-key'])
  expect(keys('items')).toHaveLength(0)
})

it.concurrent('can forget a turbo query key 3', async ({ expect }) => {
  async function fetcher() {
    return 'example'
  }

  const { query, forget, keys } = createTurboQuery({ fetcher })
  await query<string>('example-key')

  expect(keys('items')).toContain('example-key')
  forget()
  expect(keys('items')).toHaveLength(0)
})

it.concurrent('removes resolver when query fails', async ({ expect }) => {
  async function fetcher(): Promise<string> {
    throw new Error('foo')
  }

  async function fetcher2() {
    return 'example'
  }

  const { query } = createTurboQuery({ expiration: () => 0 })

  await expect(query<string>('example-key', { fetcher })).rejects.toThrowError('foo')
  await expect(query<string>('example-key', { fetcher: fetcher2 })).resolves.toBe('example')
})

it.concurrent('removes items if specified when query fails', async ({ expect }) => {
  async function fetcher(): Promise<string> {
    throw new Error('foo')
  }

  async function fetcher2() {
    return 'example'
  }

  const { query, keys } = createTurboQuery({ expiration: () => 0 })

  await query<string>('example-key', { fetcher: fetcher2 })
  expect(keys('items')).toContain('example-key')
  await expect(
    query<string>('example-key', { fetcher, stale: false, removeOnError: true })
  ).rejects.toThrowError('foo')
  expect(keys('items')).not.toContain('example-key')
})

it.concurrent('can subscribe to errors', async ({ expect }) => {
  async function fetcher(): Promise<string> {
    throw new Error('foo')
  }

  const { query, subscribe } = createTurboQuery({ fetcher, expiration: () => 0 })

  let err: Error | undefined
  subscribe<Error>('example-key', 'error', function (e) {
    err = e
  })

  await expect(query<string>('example-key')).rejects.toThrowError('foo')
  expect(err).toBeDefined()
  expect(err?.message).toBe('foo')
})

it.concurrent('can give a fresh instance if needed', async ({ expect }) => {
  let times = 0
  async function fetcher() {
    times++
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 1000 })

  await query('example-key')
  expect(times).toBe(1)
  await query('example-key')
  expect(times).toBe(1)
  await query('example-key', { fresh: true })
  expect(times).toBe(2)
})

it.concurrent('uses stale data while resolving', async ({ expect }) => {
  function fetcher(slow?: boolean) {
    return async function () {
      if (slow) await new Promise((r) => setTimeout(r, 100))
      return `example-${slow ? 'slow' : 'fast'}`
    }
  }

  const { query } = createTurboQuery({ expiration: () => 0 })

  const data = await query('example-key', { fetcher: fetcher(false) })
  expect(data).toBe('example-fast')

  const data2 = await query('example-key', { fetcher: fetcher(true) })
  expect(data2).toBe('example-fast')

  const data3 = await query('example-key', { fetcher: fetcher(true) })
  expect(data3).toBe('example-fast')

  await new Promise((r) => setTimeout(r, 100))

  const data4 = await query('example-key', { fetcher: fetcher(true) })
  expect(data4).toBe('example-slow')
})

it.concurrent('can get expiration date of items', async ({ expect }) => {
  async function fetcher() {
    return 'foo'
  }

  const { query, expiration } = createTurboQuery({ fetcher })

  await query('example-key')

  expect(expiration('bad-key')).toBeUndefined()
  expect(expiration('example-key')).toBeInstanceOf(Date)
})

it.concurrent('can hydrate keys', async ({ expect }) => {
  async function fetcher() {
    return 'foo'
  }

  const { query, hydrate } = createTurboQuery({ fetcher, expiration: () => 1000 })

  const expiresAt = new Date()
  expiresAt.setMilliseconds(expiresAt.getMilliseconds() + 1000)

  hydrate('example-key', 'bar', expiresAt)
  const result = await query('example-key')
  const result2 = await query('example-key')

  expect(result).toBe('bar')
  expect(result2).toBe('bar')
})

it.concurrent('can hydrate keys without expiration', async ({ expect }) => {
  async function fetcher() {
    return 'foo'
  }

  const { query, hydrate } = createTurboQuery({ fetcher, expiration: () => 1000 })

  hydrate('example-key', 'bar')
  // Stale hydrated result (because no expiration given)
  const result = await query('example-key')
  const result2 = await query('example-key')

  expect(result).toBe('bar')
  expect(result2).toBe('foo')
})

it.concurrent('can hydrate multiple keys', async ({ expect }) => {
  async function fetcher() {
    return 'foo'
  }

  const { query, hydrate } = createTurboQuery({ fetcher, expiration: () => 1000 })

  const expiresAt = new Date()
  expiresAt.setMilliseconds(expiresAt.getMilliseconds() + 1000)

  hydrate(['example-key', 'example-key2'], 'bar', expiresAt)
  const result = await query('example-key')
  const result2 = await query('example-key2')
  const result3 = await query('example-key')
  const result4 = await query('example-key2')

  expect(result).toBe('bar')
  expect(result2).toBe('bar')
  expect(result3).toBe('bar')
  expect(result4).toBe('bar')
})
