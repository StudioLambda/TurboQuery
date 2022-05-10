import { TurboCache, createTurboCache } from './cache'
import { TurboEvents, createTurboEvents, TurboListener } from './events'

/**
 * Determines how we store items in the items cache.
 */
interface ItemsCacheItem<T = any> {
  /**
   * Stores the cache item.
   */
  item: T

  /**
   * Determines the expiration date of the item.
   */
  expiresAt: Date
}

/**
 * Determines how we store items in the resolvers cache.
 */
interface ResolversCacheItem<T> {
  /**
   * The resolvable item.
   */
  item: Promise<T>

  /**
   * The abort controller for the request.
   */
  controller: AbortController
}

/**
 * Represents the available configuration options
 * for a turbo query instance.
 */
export interface TurboQueryConfiguration extends TurboQueryOptions {
  /**
   * Determines the resolved items cache to use.
   */
  itemsCache?: TurboCache<ItemsCacheItem>

  /**
   * Determines the resolvers cache to use.
   */
  resolversCache?: TurboCache<ResolversCacheItem<any>>

  /**
   * Stores the event system.
   */
  events?: TurboEvents
}

export interface TurboFetcherAdditional {
  /**
   * An abort signal to cancel pending queries.
   */
  signal: AbortSignal
}

/**
 * The available options for turbo query.
 */
export interface TurboQueryOptions<T = any> {
  /**
   * Determines the item deduplication interval.
   * This determines how many milliseconds an item
   * is considered valid.
   */
  expiration?(item: T): number

  /**
   * Determines the fetcher function to use.
   */
  fetcher?(key: string, additional: TurboFetcherAdditional): Promise<T>

  /**
   * Determines if we can return a stale item.
   * If `true`, it will return the previous stale item
   * stored in the cache if it has expired. It will attempt
   * to revalidate it in the background. If `false`, the returned
   * promise will be the revalidation promise.
   */
  stale?: boolean

  /**
   * Removes the stored item if there is an error in the request.
   * By default, we don't remove the item upon failure, only the resolver
   * is removed from the cache.
   */
  removeOnError?: boolean

  /**
   * Determines if the result should be a fresh fetched
   * instance regardless of any cached value or its expiration time.
   */
  fresh?: boolean
}

/**
 * Determines the cache type.
 */
export type TurboCacheType = 'resolvers' | 'items'

/**
 * The turbo mutation function type.
 */
export type TurboMutateFunction<T> = (old?: T, expiresAt?: Date) => T

/**
 * The available mutation values.
 */
export type TurboMutateValue<T> = T | TurboMutateFunction<T>

/**
 * Represents the methods a turbo query
 * should implement.
 */
export interface TurboQuery {
  /**
   * Configures the current instance of turbo query.
   */
  configure(options?: Partial<TurboQueryConfiguration>): void

  /**
   * Fetches the key information using a fetcher.
   * The returned promise contains the result item.
   */
  query<T = any>(key: string, options?: TurboQueryOptions<T>): Promise<T>

  /**
   * Subscribes to a given event on a key. The event handler
   * does have a payload parameter that will contain relevant
   * information depending on the event type.
   */
  subscribe<T = any>(
    key: string,
    event: 'refetching',
    listener: TurboListener<Promise<T>>
  ): () => void
  subscribe<T = any>(key: string, event: 'resolved', listener: TurboListener<T>): () => void
  subscribe<T = any>(key: string, event: 'mutated', listener: TurboListener<T>): () => void
  subscribe<T = any>(key: string, event: 'aborted', listener: TurboListener<Promise<T>>): () => void
  subscribe<T = any>(key: string, event: 'forgotten', listener: TurboListener<T>): () => void
  subscribe<T = any>(key: string, event: 'error', listener: TurboListener<T>): () => void
  subscribe<T = any>(
    key: string,
    event: TurboQueryEvent,
    listener: TurboQueryListener<T>
  ): () => void

  /**
   * Mutates the key with a given optimistic value.
   * The mutated value is considered expired and will be
   * replaced immediatly if a refetch happens.
   */
  mutate<T = any>(key: string, item: TurboMutateValue<T>): void

  /**
   * Aborts the active resolvers on each key
   * by calling `.abort()` on the `AbortController`.
   * The fetcher is responsible for using the
   * `AbortSignal` to cancel the job.
   */
  abort(key?: string | string[], reason?: any): void

  /**
   * Forgets the given keys from the cache.
   * Removes items from both, the cache and resolvers.
   */
  forget(keys?: string | string[]): void

  /**
   * Returns the given keys for the given cache.
   */
  keys(cache?: TurboCacheType): string[]

  /**
   * Returns the expiration date of a given key item.
   * If the item is not in the cache, it will return `undefined`.
   */
  expiration(key: string): Date | undefined
}

/**
 * Available events on turbo query.
 */
export type TurboQueryEvent =
  | 'refetching'
  | 'resolved'
  | 'mutated'
  | 'aborted'
  | 'forgotten'
  | 'error'

/**
 * Event listeners of turbo query.
 */
export type TurboQueryListener<T> = TurboListener<Promise<T> | T>

/**
 * Creates a new turbo query instance.
 */
export function createTurboQuery(instanceOptions?: TurboQueryConfiguration): TurboQuery {
  /**
   * Stores the default expiration function.
   */
  function defaultExpiration() {
    return 2000
  }

  /**
   * Stores the default fetcher function.
   */
  async function defaultFetcher() {
    throw new Error('No fetcher defined. Please add a fetcher first.')
  }

  /**
   * Stores the items cache.
   */
  let itemsCache = instanceOptions?.itemsCache ?? createTurboCache()

  /**
   * Stores the resolvers cache.
   */
  let resolversCache = instanceOptions?.resolversCache ?? createTurboCache()

  /**
   * Event manager.
   */
  let events = instanceOptions?.events ?? createTurboEvents()

  /**
   * Stores the expiration time of an item.
   */
  let instanceExpiration = instanceOptions?.expiration ?? defaultExpiration

  /**
   * Determines the fetcher function to use.
   */
  let instanceFetcher = instanceOptions?.fetcher ?? defaultFetcher

  /**
   * Determines if we can return a stale item.
   * If `true`, it will return the previous stale item
   * stored in the cache if it has expired. It will attempt
   * to revalidate it in the background. If `false`, the returned
   * promise will be the revalidation promise.
   */
  let instanceStale = instanceOptions?.stale ?? true

  /**
   * Removes the stored item if there is an error in the request.
   * By default, we don't remove the item upon failure, only the resolver
   * is removed from the cache.
   */
  let instanceRemoveOnError = instanceOptions?.removeOnError ?? false

  /**
   * Determines if the result should be a fresh fetched
   * instance regardless of any cached value or its expiration time.
   */
  let instanceFresh = instanceOptions?.fresh ?? false

  /**
   * Configures the current instance of turbo query.
   */
  function configure(options?: TurboQueryConfiguration): void {
    itemsCache = options?.itemsCache ?? itemsCache
    resolversCache = options?.resolversCache ?? resolversCache
    events = options?.events ?? events
    instanceExpiration = options?.expiration ?? instanceExpiration
    instanceFetcher = options?.fetcher ?? instanceFetcher
    instanceStale = options?.stale ?? instanceStale
    instanceRemoveOnError = options?.removeOnError ?? instanceRemoveOnError
    instanceFresh = options?.fresh ?? instanceFresh
  }

  /**
   * Subscribes to a given event on a key. The event handler
   * does have a payload parameter that will contain relevant
   * information depending on the event type.
   * If there's a pending resolver for that key, the `refetching`
   * event is fired immediatly.
   */
  function subscribe<T = any>(
    key: string,
    event: TurboQueryEvent,
    listener: TurboQueryListener<T>
  ): () => void {
    events.subscribe(`${event}:${key}`, listener)
    // For the refetching event, we want to immediatly return if there's
    // a pending resolver.
    if (event === 'refetching' && resolversCache.has(key)) {
      listener(resolversCache.get<ResolversCacheItem<T>>(key).item)
    }
    return function () {
      events.unsubscribe(`${event}:${key}`, listener)
    }
  }

  /**
   * Mutates the key with a given optimistic value.
   * The mutated value is considered expired and will be
   * replaced immediatly if a refetch happens.
   */
  function mutate<T = any>(key: string, item: TurboMutateValue<T>): void {
    if (typeof item === 'function') {
      const fn = item as TurboMutateFunction<T>
      const cached = itemsCache.get<ItemsCacheItem<T>>(key)
      item = fn(cached.item, cached.expiresAt)
    }
    itemsCache.set(key, { item, expiresAt: new Date() })
    events.emit(`mutated:${key}`, item)
  }

  /**
   * Determines if the given key is currently resolving.
   */
  function keys(type: TurboCacheType = 'items'): string[] {
    return type === 'items' ? itemsCache.keys() : resolversCache.keys()
  }

  /**
   * Aborts the active resolvers on each key
   * by calling `.abort()` on the `AbortController`.
   * The fetcher is responsible for using the
   * `AbortSignal` to cancel the job.
   * If no keys are provided, all resolvers are aborted.
   */
  function abort(cacheKeys?: string | string[], reason?: any): void {
    const resolverKeys =
      typeof cacheKeys === 'string' ? [cacheKeys] : cacheKeys ?? keys('resolvers')
    for (const key of resolverKeys) {
      if (resolversCache.has(key)) {
        const resolver = resolversCache.get(key)
        resolver.controller.abort(reason)
        resolversCache.remove(key)
        events.emit(`aborted:${key}`, resolver.item)
      }
    }
  }

  /**
   * Forgets the given keys from the items cache.
   * Does not remove any resolvers.
   * If no keys are provided the items cache is cleared.
   */
  function forget(cacheKeys?: string | string[]): void {
    const itemKeys = typeof cacheKeys === 'string' ? [cacheKeys] : cacheKeys ?? keys('items')
    for (const key of itemKeys) {
      if (itemsCache.has(key)) {
        const item = itemsCache.get(key)
        itemsCache.remove(key)
        events.emit(`forgotten:${key}`, item.item)
      }
    }
  }

  /**
   * Returns the expiration date of a given key item.
   * If the item is not in the cache, it will return `undefined`.
   */
  function expiration(key: string): Date | undefined {
    return itemsCache.has(key) ? itemsCache.get(key).expiresAt : undefined
  }

  /**
   * Fetches the key information using a fetcher.
   * The returned promise contains the result item.
   */
  async function query<T = any>(key: string, options?: TurboQueryOptions<T>): Promise<T> {
    /**
     * Stores the expiration time of an item.
     */
    const expiration = options?.expiration ?? instanceExpiration

    /**
     * Determines the fetcher function to use.
     */
    const fetcher = options?.fetcher ?? instanceFetcher

    /**
     * Determines if we can return a sale item
     * If true, it will return the previous stale item
     * stored in the cache if it has expired. It will attempt
     * to revalidate it in the background. If false, the returned
     * promise will be the revalidation promise.
     */
    const stale = options?.stale ?? instanceStale

    /**
     * Removes the stored item if there is an error in the request.
     * By default, we don't remove the item upon failure, only the resolver
     * is removed from the cache.
     */
    const removeOnError = options?.removeOnError ?? instanceRemoveOnError

    /**
     * Determines if the result should be a fresh fetched
     * instance regardless of any cached value or its expiration time.
     */
    const fresh = options?.fresh ?? instanceOptions?.fresh

    // Force fetching of the data.
    async function refetch(key: string): Promise<T> {
      try {
        // Check if there's a pending resolver for that data.
        if (resolversCache.has(key))
          return await resolversCache.get<ResolversCacheItem<T>>(key).item

        // Create the abort controller that will be
        // called when a query is aborted.
        const controller = new AbortController()

        // Initiate the fetching request.
        const result = fetcher(key, { signal: controller.signal })

        // Adds the resolver to the cache.
        resolversCache.set(key, { item: result, controller })
        events.emit(`refetching:${key}`, result)

        // Awaits the fetching to get the result item.
        const item = await result

        // Removes the resolver from the cache.
        resolversCache.remove(key)

        // Create the expiration time for the item.
        const expiresAt = new Date()
        expiresAt.setMilliseconds(expiresAt.getMilliseconds() + expiration(item))

        // Set the item to the cache.
        itemsCache.set(key, { item, expiresAt })
        events.emit(`resolved:${key}`, item)

        // Return back the item.
        return item
      } catch (error) {
        // Remove the resolver.
        resolversCache.remove(key)
        // Check if the item should be removed as well.
        if (removeOnError) itemsCache.remove(key)
        // Notify of the error.
        events.emit(`error:${key}`, error)
        // Throw back the error.
        throw error
      }
    }

    // We want to force a fresh item ignoring any current cached
    // value or its expiration time.
    if (fresh) return await refetch(key)

    // Check if there's an item in the cache for the given key.
    if (itemsCache.has(key)) {
      // We must check if that item has actually expired.
      // to trigger a revalidation if needed.
      const cached = itemsCache.get<ItemsCacheItem<T>>(key)
      const hasExpired = cached.expiresAt < new Date()

      // The item has expired and the fetch is able
      // to return a stale item while revalidating
      // in the background.
      if (hasExpired && stale) {
        // We have to silence the error to avoid unhandled promises.
        // Refer to the error event if you need full controll of errors.
        refetch(key).catch(() => {})
        return cached.item
      }

      // The item has expired but we dont allow stale
      // responses so we need to wait for the revalidation.
      if (hasExpired) return await refetch(key)

      // The item has not yet expired, so we can return it and
      // assume it's valid since it's not yet considered stale.
      return cached.item
    }

    // The item is not found in  the items cache.
    // We need to perform a revalidation of the item.
    return await refetch(key)
  }

  return { query, subscribe, mutate, configure, abort, forget, keys, expiration }
}
