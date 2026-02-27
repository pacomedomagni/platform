import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared mutable data store for E2E tests.
 * Uses a temp JSON file to persist across test files — Jest runs each file
 * in a separate module context/worker, so in-memory state doesn't survive.
 *
 * Tests run in numeric order (01, 02, ...), so later tests reference
 * IDs created by earlier ones.
 */

const STORE_FILE = path.join(__dirname, '..', '..', '.e2e-store.json');

function loadStore(): Record<string, any> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    }
  } catch {
    // corrupted file
  }
  return {};
}

function saveStore(data: Record<string, any>) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

// Mutating array methods that need to trigger a save
const ARRAY_MUTATORS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill',
]);

/**
 * Wraps an array so that mutating methods (push, splice, etc.)
 * automatically persist the full store back to disk.
 */
function createArrayProxy(arr: any[], parentKey: string): any[] {
  return new Proxy(arr, {
    get(target, prop) {
      if (typeof prop === 'string' && ARRAY_MUTATORS.has(prop)) {
        return (...args: any[]) => {
          const result = (target as any)[prop](...args);
          // Re-save the whole store with the mutated array
          const current = loadStore();
          current[parentKey] = target;
          saveStore(current);
          return result;
        };
      }
      return (target as any)[prop];
    },
    set(target, prop, value) {
      (target as any)[prop] = value;
      const current = loadStore();
      current[parentKey] = target;
      saveStore(current);
      return true;
    },
  });
}

/**
 * A Proxy that auto-persists every write to the JSON file,
 * and reloads from disk on every read.
 * Array properties are wrapped so that .push(), .splice() etc. auto-save.
 */
const handler: ProxyHandler<Record<string, any>> = {
  get(_target, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'toJSON') return () => loadStore();
    const current = loadStore();
    const value = current[prop];
    if (Array.isArray(value)) {
      return createArrayProxy(value, prop);
    }
    return value;
  },
  set(_target, prop: string | symbol, value: any) {
    if (typeof prop === 'symbol') return false;
    const current = loadStore();
    current[prop] = value;
    saveStore(current);
    return true;
  },
};

export const store = new Proxy({} as Record<string, any>, handler);
