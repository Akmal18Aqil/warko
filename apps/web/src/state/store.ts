import { useSyncExternalStore } from "react";

export type Store<S> = {
  get(): S;
  /** Merges `partial` into the state and notifies subscribers; a no-op when no value changed. */
  set(partial: Partial<S> | ((state: S) => Partial<S>)): void;
  /** Like `set`, but keys whose new value is structurally equal (JSON) to the current one are kept, so server polls do not re-render consumers. */
  setIfChanged(partial: Partial<S>): void;
  subscribe(listener: () => void): () => void;
};

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();

  const commit = (next: S) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    get: () => state,
    set(partial) {
      const patch = typeof partial === "function" ? partial(state) : partial;
      const keys = Object.keys(patch) as (keyof S)[];
      if (keys.every((key) => Object.is(state[key], patch[key]))) return;
      commit({ ...state, ...patch });
    },
    setIfChanged(partial) {
      const patch: Partial<S> = {};
      for (const key of Object.keys(partial) as (keyof S)[]) {
        if (JSON.stringify(state[key]) !== JSON.stringify(partial[key])) patch[key] = partial[key];
      }
      if (Object.keys(patch).length > 0) commit({ ...state, ...patch });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Subscribes to `selector(state)`. The selector must return a value that is referentially stable while the data is unchanged. */
export function useStore<S, T>(store: Store<S>, selector: (state: S) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}
