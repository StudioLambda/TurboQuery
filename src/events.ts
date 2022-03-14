export type TurboListener<T> = (payload: T) => void

export interface TurboEvents<E = string> {
  /**
   * Subscribes a given listener.
   */
  subscribe<T = any>(key: E, listener: TurboListener<T>): void

  /**
   * Unsubscribes the given listener.
   */
  unsubscribe<T = any>(key: E, listener: TurboListener<T>): void

  /**
   * Emits an event to all active listeners.
   */
  emit<T = any>(key: E, payload: T): void
}

export function createTurboEvents<E = string>(): TurboEvents<E> {
  /**
   * Stores the list of active listeners.
   */
  const listeners = new Map<E, TurboListener<any>[]>()

  /**
   * Subscribes a given listener.
   */
  function subscribe<T = any>(key: E, listener: TurboListener<T>) {
    // Add the list if it didn't exist before.
    if (!listeners.has(key)) listeners.set(key, [])

    // Check if the listener has already been added.
    if (listeners.get(key)!.includes(listener)) return

    // Add the listener to the active list.
    listeners.get(key)!.push(listener)
  }

  /**
   * Unsubscribes the given listener.
   */
  function unsubscribe<T = any>(key: E, listener: TurboListener<T>) {
    // Check if the key exists.
    if (!listeners.has(key)) return

    // Check if the listener is active.
    if (!listeners.get(key)!.includes(listener)) return

    // Remove the event listener.
    listeners.get(key)!.splice(listeners.get(key)!.indexOf(listener), 1)

    // Remove the key if there are no more listeners active.
    if (listeners.get(key)!.length === 0) listeners.delete(key)
  }

  /**
   * Emits an event to all active listeners.
   */
  function emit<T = any>(key: E, payload: T) {
    // Check if the key exists
    if (!listeners.has(key)) return

    // Call all the active listeners with the given payload.
    listeners.get(key)!.forEach((listener) => listener(payload))
  }

  return { subscribe, unsubscribe, emit }
}
