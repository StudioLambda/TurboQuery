/**
 * Represents the methods a cache should implement
 * in order to be usable by vue-swr.
 */
export interface TurboCache<T = any> {
  /**
   * Gets an item from the cache.
   */
  get<D extends T = T>(key: string): D

  /**
   * Sets an item to the cache.
   */
  set<D extends T = T>(key: string, value: D): void

  /**
   * Determines if the cache has a given key.
   */
  has(key: string): boolean

  /**
   * Removes a key-value pair from the cache.
   */
  remove(key: string): void

  /**
   * Removes all the key-value pairs from the cache.
   */
  clear(): void

  /**
   * Returns the current cached keys.
   */
  keys(): string[]
}

/**
 * Creates a new turbocache instance.
 */
export function createTurboCache<T = any>(): TurboCache<T> {
  /**
   * Stores the items of the cache.
   */
  const items = new Map<string, T>()

  /**
   * Gets an item from the cache.
   */
  function get<D extends T = T>(key: string): D {
    if (!items.has(key)) throw new Error(`The key ${key} is not in the items`)
    return items.get(key) as D
  }

  /**
   * Sets an item to the cache.
   */
  function set<D extends T = T>(key: string, value: D): void {
    items.set(key, value)
  }

  /**
   * Determines if the cache has a given key.
   */
  function has(key: string): boolean {
    return items.has(key)
  }

  /**
   * Removes a key-value pair from the cache.
   */
  function remove(key: string): void {
    items.delete(key)
  }

  /**
   * Removes all the key-value pairs from the cache.
   */
  function clear(): void {
    items.clear()
  }

  /**
   * Removes all the key-value pairs from the cache.
   */
  function keys(): string[] {
    return Array.from(items.keys())
  }

  return { get, set, has, remove, clear, keys }
}
