import KV from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Synchronous key-value storage for small, non-sensitive app flags.
 * Backed by SQLite. Secrets (tokens, vault keys) never go here:
 * they use expo-secure-store in later phases.
 */
export const kvStorage: StateStorage = {
  getItem: (key) => KV.getItemSync(key),
  setItem: (key, value) => KV.setItemSync(key, value),
  removeItem: (key) => KV.removeItemSync(key),
};
