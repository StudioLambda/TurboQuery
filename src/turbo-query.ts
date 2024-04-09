/**
 * Determines the shape of the TurboCache instance.
 */
export interface TurboCache<T = unknown> {
  /**
   * Gets an item from the cache.
   */
  readonly get: (key: string) => T | undefined

  /**
   * Sets an item to the cache.
   */
  readonly set: (key: string, value: T) => void

  /**
   * Removes a key-value pair from the cache.
   */
  readonly delete: (key: string) => void

  /**
   * Returns the current cached keys.
   */
  readonly keys: () => IterableIterator<string>
}

/**
 * Determines how we store items in the items cache.
 */
interface ItemsCacheItem<T = unknown> {
  /**
   * Stores the cache item.
   */
  readonly item: T

  /**
   * Determines the expiration date of the item.
   */
  readonly expiresAt: Date
}

/**
 * Determines how we store items in the resolvers cache.
 */
interface ResolversCacheItem<T> {
  /**
   * The resolvable item.
   */
  readonly item: Promise<T>

  /**
   * The abort controller for the request.
   */
  readonly controller: AbortController
}

/**
 * Represents the available configuration options
 * for a turbo query instance.
 */
export interface TurboQueryConfiguration extends TurboQueryOptions {
  /**
   * Determines the resolved items cache to use.
   */
  readonly itemsCache?: TurboCache<ItemsCacheItem<unknown>>

  /**
   * Determines the resolvers cache to use.
   */
  readonly resolversCache?: TurboCache<ResolversCacheItem<unknown>>

  /**
   * Stores the event system.
   */
  readonly events?: EventTarget
}

export interface TurboFetcherAdditional {
  /**
   * An abort signal to cancel pending queries.
   */
  readonly signal: AbortSignal
}

/**
 * The available options for turbo query.
 */
export interface TurboQueryOptions<T = unknown> {
  /**
   * Determines the item deduplication interval.
   * This determines how many milliseconds an item
   * is considered valid.
   */
  readonly expiration?: (item: T) => number

  /**
   * Determines the fetcher function to use.
   */
  readonly fetcher?: (key: string, additional: TurboFetcherAdditional) => Promise<T>

  /**
   * Determines if we can return a stale item.
   * If `true`, it will return the previous stale item
   * stored in the cache if it has expired. It will attempt
   * to revalidate it in the background. If `false`, the returned
   * promise will be the revalidation promise.
   */
  readonly stale?: boolean

  /**
   * Removes the stored item if there is an error in the request.
   * By default, we don't remove the item upon failure, only the resolver
   * is removed from the cache.
   */
  readonly removeOnError?: boolean

  /**
   * Determines if the result should be a fresh fetched
   * instance regardless of any cached value or its expiration time.
   */
  readonly fresh?: boolean
}

/**
 * Determines the cache type.
 */
export type TurboCacheType = 'resolvers' | 'items'

/**
 * The turbo mutation function type.
 */
export type TurboMutateFunction<T> = (previous?: T, expiresAt?: Date) => T

/**
 * The available mutation values.
 */
export type TurboMutateValue<T> = T | TurboMutateFunction<T>

/**
 * The unsubscriber function.
 */
export type Unsubscriber = () => void

/**
 * The caches available on the turbo query.
 */
export interface TurboCaches {
  /**
   * A cache that contains the resolved items alongside
   * their expiration time.
   */
  readonly items: TurboCache<ItemsCacheItem<unknown>>

  /**
   * A cache that contains the resolvers alongside
   * their abort controllers.
   */
  readonly resolvers: TurboCache<ResolversCacheItem<unknown>>
}

/**
 * Represents the methods a turbo query
 * should implement.
 */
export interface TurboQuery {
  /**
   * Configures the current instance of turbo query.
   */
  readonly configure: (options?: Partial<TurboQueryConfiguration>) => void

  /**
   * Fetches the key information using a fetcher.
   * The returned promise contains the result item.
   */
  readonly query: <T = unknown>(key: string, options?: TurboQueryOptions<T>) => Promise<T>

  /**
   * Subscribes to a given event on a key. The event handler
   * does have a payload parameter that will contain relevant
   * information depending on the event type.
   */
  readonly subscribe: (key: string, event: TurboQueryEvent, listener: EventListener) => Unsubscriber

  /**
   * Mutates the key with a given optimistic value.
   * The mutated value is considered expired and will be
   * replaced immediatly if a refetch happens.
   */
  readonly mutate: <T = unknown>(key: string, item: TurboMutateValue<T>) => void

  /**
   * Aborts the active resolvers on each key
   * by calling `.abort()` on the `AbortController`.
   * The fetcher is responsible for using the
   * `AbortSignal` to cancel the job.
   */
  readonly abort: (key?: string | string[], reason?: unknown) => void

  /**
   * Forgets the given keys from the cache.
   * Removes items from both, the cache and resolvers.
   */
  readonly forget: (keys?: string | string[]) => void

  /**
   * Hydrates the given keys on the cache
   * with the given value and expiration time.
   */
  readonly hydrate: <T = unknown>(keys: string | string[], item: T, expiresAt?: Date) => void

  /**
   * Returns the given keys for the given cache.
   */
  readonly keys: (cache?: TurboCacheType) => string[]

  /**
   * Returns the expiration date of a given key item.
   * If the item is not in the cache, it will return `undefined`.
   */
  readonly expiration: (key: string) => Date | undefined

  /**
   * Returns the current snapshot of the given key.
   * If the item is not in the items cache, it will return `undefined`.
   */
  readonly snapshot: <T = unknown>(key: string) => T | undefined

  /**
   * Returns the current cache instances.
   */
  readonly caches: () => TurboCaches

  /**
   * Returns the event system.
   */
  readonly events: () => EventTarget
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
  | 'hydrated'
  | 'error'

/**
 * Stores the default fetcher function.
 */
export function defaultFetcher(
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  return async function (key: string, { signal }: TurboFetcherAdditional) {
    const response = await fetch(key, { signal })

    if (!response.ok) {
      throw new Error('Unable to fetch the data: ' + response.statusText)
    }

    return await response.json()
  }
}

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
   * Stores the items cache.
   */
  let itemsCache = instanceOptions?.itemsCache ?? new Map<string, ItemsCacheItem<unknown>>()

  /**
   * Stores the resolvers cache.
   */
  let resolversCache =
    instanceOptions?.resolversCache ?? new Map<string, ResolversCacheItem<unknown>>()

  /**
   * Event manager.
   */
  let events = instanceOptions?.events ?? new EventTarget()

  /**
   * Stores the expiration time of an item.
   */
  let instanceExpiration = instanceOptions?.expiration ?? defaultExpiration

  /**
   * Determines the fetcher function to use.
   */
  let instanceFetcher = instanceOptions?.fetcher ?? defaultFetcher(fetch)

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
  function subscribe<T = unknown>(
    key: string,
    event: TurboQueryEvent,
    listener: EventListener
  ): () => void {
    events.addEventListener(`${event}:${key}`, listener)
    const value = resolversCache.get(key)

    // For the refetching event, we want to immediatly return if there's
    // a pending resolver.
    if (event === 'refetching' && value !== undefined) {
      listener(new CustomEvent(`${event}:${key}`, { detail: value.item as Promise<T> }))
    }

    return function () {
      events.removeEventListener(`${event}:${key}`, listener)
    }
  }

  /**
   * Mutates the key with a given optimistic value.
   * The mutated value is considered expired and will be
   * replaced immediatly if a refetch happens when no expiresAt
   * is given. Otherwise the expiration time is used.
   */
  function mutate<T = unknown>(key: string, item: TurboMutateValue<T>, expiresAt?: Date): void {
    if (typeof item === 'function') {
      const fn = item as TurboMutateFunction<T>
      const value = itemsCache.get(key)

      item = fn(value?.item as T, value?.expiresAt)
    }

    itemsCache.set(key, { item, expiresAt: expiresAt ?? new Date() })
    events.dispatchEvent(new CustomEvent(`mutated:${key}`, { detail: item }))
  }

  /**
   * Returns the current snapshot of the given key.
   * If the item is not in the items cache, it will return `undefined`.
   */
  function snapshot<T = unknown>(key: string): T | undefined {
    return itemsCache.get(key)?.item as T
  }

  /**
   * Determines if the given key is currently resolving.
   */
  function keys(type: TurboCacheType = 'items'): string[] {
    return Array.from(type === 'items' ? itemsCache.keys() : resolversCache.keys())
  }

  /**
   * Aborts the active resolvers on each key
   * by calling `.abort()` on the `AbortController`.
   * The fetcher is responsible for using the
   * `AbortSignal` to cancel the job.
   * If no keys are provided, all resolvers are aborted.
   */
  function abort(cacheKeys?: string | string[], reason?: unknown): void {
    const resolverKeys =
      typeof cacheKeys === 'string' ? [cacheKeys] : cacheKeys ?? keys('resolvers')
    for (const key of resolverKeys) {
      const resolver = resolversCache.get(key)

      if (resolver !== undefined) {
        resolver.controller.abort(reason)
        resolversCache.delete(key)

        //! Should it be reason instead of resolver.item ???
        events.dispatchEvent(new CustomEvent(`aborted:${key}`, { detail: resolver.item }))
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
      const item = itemsCache.get(key)

      if (item !== undefined) {
        itemsCache.delete(key)
        events.dispatchEvent(new CustomEvent(`forgotten:${key}`, { detail: item.item }))
      }
    }
  }

  /**
   * Hydrates the given keys on the cache
   * with the given value. Hydrate should only
   * be used when you want to populate the cache.
   * Please use mutate() in most cases unless you
   * know what you are doing.
   */
  function hydrate<T = unknown>(keys: string | string[], item: T, expiresAt?: Date): void {
    for (const key of typeof keys === 'string' ? [keys] : keys) {
      itemsCache.set(key, { item, expiresAt: expiresAt ?? new Date() })
      events.dispatchEvent(new CustomEvent(`hydrated:${key}`, { detail: item }))
    }
  }

  /**
   * Returns the expiration date of a given key item.
   * If the item is not in the cache, it will return `undefined`.
   */
  function expiration(key: string): Date | undefined {
    return itemsCache.get(key)?.expiresAt
  }

  /**
   * Fetches the key information using a fetcher.
   * The returned promise contains the result item.
   */
  async function query<T = unknown>(key: string, options?: TurboQueryOptions<T>): Promise<T> {
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
        const pending = resolversCache.get(key)

        if (pending !== undefined) {
          return await (pending.item as Promise<T>)
        }

        // Create the abort controller that will be
        // called when a query is aborted.
        const controller = new AbortController()

        // Initiate the fetching request.
        const result: Promise<T> = fetcher(key, { signal: controller.signal })

        // Adds the resolver to the cache.
        resolversCache.set(key, { item: result, controller })
        events.dispatchEvent(new CustomEvent(`refetching:${key}`, { detail: result }))

        // Awaits the fetching to get the result item.
        const item = await result

        // Removes the resolver from the cache.
        resolversCache.delete(key)

        // Create the expiration time for the item.
        const expiresAt = new Date()
        expiresAt.setMilliseconds(expiresAt.getMilliseconds() + expiration(item))

        // Set the item to the cache.
        itemsCache.set(key, { item, expiresAt })
        events.dispatchEvent(new CustomEvent(`resolved:${key}`, { detail: item }))

        // Return back the item.
        return item
      } catch (error) {
        // Remove the resolver.
        resolversCache.delete(key)

        // Check if the item should be removed as well.
        if (removeOnError) {
          itemsCache.delete(key)
        }

        // Notify of the error.
        events.dispatchEvent(new CustomEvent(`error:${key}`, { detail: error }))

        // Throw back the error.
        throw error
      }
    }

    // We want to force a fresh item ignoring any current cached
    // value or its expiration time.
    if (fresh) {
      return await refetch(key)
    }

    // Check if there's an item in the cache for the given key.
    const cached = itemsCache.get(key)

    if (cached !== undefined) {
      // We must check if that item has actually expired.
      // to trigger a revalidation if needed.
      const hasExpired = cached.expiresAt <= new Date()

      // The item has expired and the fetch is able
      // to return a stale item while revalidating
      // in the background.
      if (hasExpired && stale) {
        // We have to silence the error to avoid unhandled promises.
        // Refer to the error event if you need full controll of errors.
        refetch(key).catch(() => {})

        return cached.item as T
      }

      // The item has expired but we dont allow stale
      // responses so we need to wait for the revalidation.
      if (hasExpired) {
        return await refetch(key)
      }

      // The item has not yet expired, so we can return it and
      // assume it's valid since it's not yet considered stale.
      return cached.item as T
    }

    // The item is not found in the items cache.
    // We need to perform a revalidation of the item.
    return await refetch(key)
  }

  /**
   * Returns the current cache instances.
   */
  function caches(): TurboCaches {
    return { items: itemsCache, resolvers: resolversCache }
  }

  /**
   * Returns the event system.
   */
  function localEvents() {
    return events
  }

  return {
    query,
    subscribe,
    mutate,
    configure,
    abort,
    forget,
    keys,
    expiration,
    hydrate,
    snapshot,
    caches,
    events: localEvents,
  }
}
