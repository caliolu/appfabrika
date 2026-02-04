/**
 * BMAD Cache System
 * Cache AI responses and intermediate results
 */

import { writeFile, readFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface CacheConfig {
  cacheDir: string;
  defaultTTL: number; // seconds
  maxSize: number; // max entries
  cleanupInterval: number; // seconds
}

const DEFAULT_CONFIG: CacheConfig = {
  cacheDir: '.appfabrika/cache',
  defaultTTL: 3600, // 1 hour
  maxSize: 1000,
  cleanupInterval: 300, // 5 minutes
};

class BmadCache {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize cache (create directory, start cleanup)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!existsSync(this.config.cacheDir)) {
        await mkdir(this.config.cacheDir, { recursive: true });
      }

      // Load existing cache entries to memory
      await this.loadFromDisk();

      // Start cleanup interval
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.config.cleanupInterval * 1000
      );

      this.initialized = true;
    } catch (error) {
      console.error('Cache başlatma hatası:', error);
    }
  }

  /**
   * Configure cache
   */
  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate cache key from inputs
   */
  generateKey(...inputs: (string | object)[]): string {
    const content = inputs
      .map(i => (typeof i === 'string' ? i : JSON.stringify(i)))
      .join('|');
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (this.isExpired(memEntry)) {
        await this.delete(key);
        return null;
      }
      return memEntry.value as T;
    }

    // Check disk cache
    try {
      const filePath = this.getFilePath(key);
      if (!existsSync(filePath)) {
        return null;
      }

      const content = await readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;

      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }

      // Add to memory cache
      this.memoryCache.set(key, entry);
      return entry.value;
    } catch {
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl || this.config.defaultTTL) * 1000);

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Enforce max size
    if (this.memoryCache.size > this.config.maxSize) {
      await this.evictOldest();
    }

    // Persist to disk
    try {
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);
      await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      console.error('Cache yazma hatası:', error);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    try {
      const filePath = this.getFilePath(key);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Ignore delete errors
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    try {
      const files = await readdir(this.config.cacheDir);
      await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(f => unlink(join(this.config.cacheDir, f)))
      );
    } catch {
      // Ignore clear errors
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryEntries: number;
    diskEntries: number;
    totalSize: number;
  }> {
    let diskEntries = 0;
    let totalSize = 0;

    try {
      const files = await readdir(this.config.cacheDir);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const filePath = join(this.config.cacheDir, file);
        const stats = await stat(filePath);
        diskEntries++;
        totalSize += stats.size;
      }
    } catch {
      // Ignore stat errors
    }

    return {
      memoryEntries: this.memoryCache.size,
      diskEntries,
      totalSize,
    };
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await compute();

    // Store in cache
    await this.set(key, value, ttl, metadata);

    return value;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return new Date(entry.expiresAt) < new Date();
  }

  /**
   * Get file path for cache key
   */
  private getFilePath(key: string): string {
    return join(this.config.cacheDir, `${key}.json`);
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    if (!existsSync(this.config.cacheDir)) {
      await mkdir(this.config.cacheDir, { recursive: true });
    }
  }

  /**
   * Load cache entries from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      if (!existsSync(this.config.cacheDir)) {
        return;
      }

      const files = await readdir(this.config.cacheDir);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const filePath = join(this.config.cacheDir, file);
          const content = await readFile(filePath, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry;

          if (!this.isExpired(entry)) {
            this.memoryCache.set(entry.key, entry);
          } else {
            // Clean up expired entries
            await unlink(filePath);
          }
        } catch {
          // Skip invalid cache files
        }
      }
    } catch {
      // Ignore load errors
    }
  }

  /**
   * Evict oldest entries to make room
   */
  private async evictOldest(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) =>
      new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime()
    );

    // Remove oldest 10%
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      await this.delete(entries[i][0]);
    }
  }

  /**
   * Cleanup expired entries
   */
  private async cleanup(): Promise<void> {
    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        await this.delete(key);
      }
    }

    // Cleanup disk cache
    try {
      if (!existsSync(this.config.cacheDir)) {
        return;
      }

      const files = await readdir(this.config.cacheDir);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const filePath = join(this.config.cacheDir, file);
          const content = await readFile(filePath, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry;

          if (this.isExpired(entry)) {
            await unlink(filePath);
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Close cache (stop cleanup, flush pending)
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.initialized = false;
  }
}

// Singleton instance
export const cache = new BmadCache();

// Convenience exports
export const initCache = cache.init.bind(cache);
export const getFromCache = cache.get.bind(cache);
export const setInCache = cache.set.bind(cache);
export const deleteFromCache = cache.delete.bind(cache);
export const clearCache = cache.clear.bind(cache);
export const getCacheStats = cache.getStats.bind(cache);
export const getOrCompute = cache.getOrCompute.bind(cache);
export const generateCacheKey = cache.generateKey.bind(cache);
