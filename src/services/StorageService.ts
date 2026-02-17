/**
 * Storage Service
 * Handles persistent storage of game state using browser localStorage
 * Replaces Apple FileManager from Swift implementation
 */

const STORAGE_PREFIX = 'franchise_manager_';

/**
 * Utility class for browser storage operations
 */
export class StorageService {
  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      console.warn('⚠️ [Storage] localStorage is not available (private browsing or quota exceeded)');
      return false;
    }
  }

  /**
   * Save data to localStorage with error handling
   * @param key - The storage key
   * @param data - The data to save (will be serialized to JSON)
   * @returns true if save was successful, false otherwise
   */
  static save<T>(key: string, data: T): boolean {
    if (!this.isAvailable()) {
      console.error('❌ [Storage] Cannot save: localStorage not available');
      return false;
    }

    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const json = JSON.stringify(data);
      localStorage.setItem(prefixedKey, json);
      console.log(`💾 [Storage] Saved '${key}' (${(json.length / 1024).toFixed(2)} KB)`);
      return true;
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.code === 22) { // QuotaExceededError
          console.error('❌ [Storage] Quota exceeded - localStorage is full');
        } else {
          console.error(`❌ [Storage] Error code ${error.code}: ${error.message}`);
        }
      } else {
        console.error('❌ [Storage] Unknown error:', error);
      }
      return false;
    }
  }

  /**
   * Load data from localStorage with error handling
   * @param key - The storage key
   * @returns The loaded data, or null if not found or error occurred
   */
  static load<T>(key: string): T | null {
    if (!this.isAvailable()) {
      console.error('❌ [Storage] Cannot load: localStorage not available');
      return null;
    }

    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const json = localStorage.getItem(prefixedKey);

      if (json === null) {
        console.log(`ℹ️ [Storage] No data found for key '${key}'`);
        return null;
      }

      const data = JSON.parse(json) as T;
      console.log(`📂 [Storage] Loaded '${key}' (${(json.length / 1024).toFixed(2)} KB)`);
      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`❌ [Storage] Failed to parse JSON for key '${key}': Data may be corrupted`);
      } else {
        console.error(`❌ [Storage] Error loading '${key}':`, error);
      }
      return null;
    }
  }

  /**
   * Remove data from localStorage
   * @param key - The storage key
   * @returns true if removal was successful, false otherwise
   */
  static remove(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      localStorage.removeItem(prefixedKey);
      console.log(`🗑️ [Storage] Removed '${key}'`);
      return true;
    } catch (error) {
      console.error(`❌ [Storage] Error removing '${key}':`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in localStorage
   */
  static exists(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    return localStorage.getItem(prefixedKey) !== null;
  }

  /**
   * Get all save slots (returns array of slot names)
   */
  static getAllSlots(): string[] {
    if (!this.isAvailable()) {
      return [];
    }

    const slots: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        slots.push(key.substring(STORAGE_PREFIX.length));
      }
    }
    return slots;
  }

  /**
   * Clear all game saves (DESTRUCTIVE - use with caution)
   */
  static clearAllSaves(): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const slots = this.getAllSlots();
      slots.forEach(slot => this.remove(slot));
      console.log(`🗑️ [Storage] Cleared ${slots.length} save(s)`);
      return true;
    } catch (error) {
      console.error('❌ [Storage] Error clearing saves:', error);
      return false;
    }
  }

  /**
   * Hydrate Date objects in parsed data
   * localStorage serializes Dates as ISO strings, this converts them back
   */
  static hydrateDate(data: any, dateFields: string[]): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const hydrated = { ...data };
    dateFields.forEach(field => {
      if (hydrated[field] && typeof hydrated[field] === 'string') {
        hydrated[field] = new Date(hydrated[field]);
      }
    });

    return hydrated;
  }
}
