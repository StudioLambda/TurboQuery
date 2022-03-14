import { expect, it } from 'vitest'
import { createTurboEvents } from '../src/events'

it.concurrent('can create events', async () => {
  const events = createTurboEvents()

  expect(events).not.toBeNull()
})

it.concurrent('can subscribe and emit events', async () => {
  const events = createTurboEvents()
  let result: number = 0

  function handler(item: number) {
    result = item
  }

  events.subscribe('some-event', handler)
  events.emit('some-event', 100)

  expect(result).toBe(100)
})

it.concurrent('can unsubscribe from events', async () => {
  const events = createTurboEvents()
  let result: number = 0

  function handler(item: number) {
    result = item
  }

  events.subscribe('some-event', handler)
  events.unsubscribe('some-event', handler)
  events.emit('some-event', 100)

  expect(result).toBe(0)
})

it.concurrent('can have multiple subscribers to an event', async () => {
  const events = createTurboEvents()
  let result: number = 0
  let result2: number = 0

  function handler(item: number) {
    result = item
  }

  function handler2(item: number) {
    result2 = item
  }

  events.subscribe('some-event', handler)
  events.subscribe('some-event', handler2)
  events.emit('some-event', 100)

  expect(result).toBe(100)
  expect(result2).toBe(100)
})

it.concurrent('can ignore handlers that are already added on a cache', async () => {
  const events = createTurboEvents()

  function handler() {
    // ...
  }

  events.subscribe('some-event', handler)

  expect(() => events.subscribe('some-event', handler)).not.toThrowError()
})

it.concurrent('can ignore unsubscriptions from unknown keys on a cache', async () => {
  const events = createTurboEvents()

  function handler() {
    // ...
  }

  expect(() => events.unsubscribe('some-event', handler)).not.toThrowError()
})

it.concurrent('can ignore unsubscriptions from unknown handlers on a cache', async () => {
  const events = createTurboEvents()

  function handler() {
    // ...
  }

  events.subscribe('some-event', handler)

  function handler2() {
    // ...
  }

  expect(() => events.unsubscribe('some-event', handler2)).not.toThrowError()
})
