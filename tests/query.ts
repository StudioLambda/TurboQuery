import { expect, it } from 'vitest'
import { createTurboQuery, TurboFetcherAdditional } from '../src/query'
import { createTurboCache } from '../src/cache'
import { createTurboEvents } from '../src/events'

it.concurrent('can create a turbo query', async () => {
  const turboquery = createTurboQuery()

  expect(turboquery).not.toBeNull()
})

it.concurrent('can fails to query without fetcher', async () => {
  const { query } = createTurboQuery()

  await expect(() => query<string>('example-key')).rejects.toThrowError()
})

it.concurrent('can query resources', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher })

  const resource = await query<string>('example-key')

  expect(resource).toBe('example')
})

it.concurrent('can fetch expired resources while returning stale', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 100 })

  await query<string>('example-key')
  await new Promise((r) => setTimeout(r, 100))
  const resource = await query<string>('example-key')

  expect(resource).toBe('example')
})

it.concurrent('can fetch expired resources while not returning stale', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query } = createTurboQuery({ fetcher, expiration: () => 100 })

  await query<string>('example-key')
  await new Promise((r) => setTimeout(r, 100))
  const resource = await query<string>('example-key', { stale: false })

  expect(resource).toBe('example')
})

it.concurrent('returns the same promise when resources are resolving', async () => {
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

it.concurrent('does respect dedupe interval of resources', async () => {
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

it.concurrent('does respect dedupe interval of resources 2', async () => {
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

it.concurrent('can subscribe to refetchings on resources', async () => {
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

it.concurrent('can subscribe to resolutions on resources', async () => {
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

it.concurrent('can subscribe to mutations on resources', async () => {
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

it.concurrent('can subscribe to aborts on resources', async () => {
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
    console.log(item)
  })

  const r = query('example-key', { fetcher })
  abort()
  unsubscribe()

  await expect(() => r).rejects.toThrowError('aborted')
  await expect(() => result).rejects.toThrowError('aborted')
})

it.concurrent('can subscribe to forgets on resources', async () => {
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

it.concurrent('can reconfigure turbo query', async () => {
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
  })

  const result = await query('some-key')

  expect(result).toBe('different')
})

it.concurrent('can reconfigure turbo query 2', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query, configure } = createTurboQuery({ fetcher })

  configure()

  const result = await query('some-key')

  expect(result).toBe('example')
})

it.concurrent('can abort turbo query', async () => {
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

it.concurrent('can abort turbo query 2', async () => {
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

it.concurrent('can abort turbo query 3', async () => {
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

it.concurrent('can get the item keys of a turbo query', async () => {
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

it.concurrent('can get the resolvers keys of a turbo query', async () => {
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

it.concurrent('can forget a turbo query key', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query, forget, keys } = createTurboQuery({ fetcher })
  await query<string>('example-key')

  expect(keys('items')).toContain('example-key')
  forget('example-key')
  expect(keys('items')).toHaveLength(0)
})

it.concurrent('can forget a turbo query key 2', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query, forget, keys } = createTurboQuery({ fetcher })
  await query<string>('example-key')

  expect(keys('items')).toContain('example-key')
  forget(['example-key'])
  expect(keys('items')).toHaveLength(0)
})

it.concurrent('can forget a turbo query key 3', async () => {
  async function fetcher() {
    return 'example'
  }

  const { query, forget, keys } = createTurboQuery({ fetcher })
  await query<string>('example-key')

  expect(keys('items')).toContain('example-key')
  forget()
  expect(keys('items')).toHaveLength(0)
})
