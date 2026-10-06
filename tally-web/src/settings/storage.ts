/**
 * Where settings persist. Async from day one because the React Native replacement
 * (@react-native-async-storage/async-storage) has an async API; on the web it is localStorage
 * wrapped in Promise.resolve (platform/webStorage.ts).
 */
export interface StoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** An in-memory port for tests. */
export function memoryStorage(initial: Record<string, string> = {}): StoragePort & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (key) => Promise.resolve(data.get(key) ?? null),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}
