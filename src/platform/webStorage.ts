/**
 * The StoragePort over localStorage (P:1048-1056). Promise.resolve inside try/catch: Safari
 * private mode, blocked site data and a full quota all throw on access, and the game must boot
 * from DEFAULTS and run without persistence rather than fail. Hydration resolves in the same tick.
 */
import type { StoragePort } from "../settings/storage";

export const webStorage: StoragePort = {
  get(key) {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // nothing to do: the settings simply do not survive a reload
    }
    return Promise.resolve();
  },
};
