/**
 * storage.ts — thin persistence wrapper
 * Uses localStorage on web, falls back gracefully on native (no-op).
 * Drop-in compatible with AsyncStorage API when that package is added.
 */

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) return window.localStorage.getItem(key);
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isWeb) window.localStorage.removeItem(key);
  },
};
