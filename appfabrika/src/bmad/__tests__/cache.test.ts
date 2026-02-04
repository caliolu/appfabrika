/**
 * Cache Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { cache, generateCacheKey } from '../cache.js';

const TEST_CACHE_DIR = join(process.cwd(), '.test-cache');

describe('Cache', () => {
  beforeEach(async () => {
    cache.configure({ cacheDir: TEST_CACHE_DIR });
    await cache.init();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.close();
    try {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('init', () => {
    it('should create cache directory', async () => {
      expect(existsSync(TEST_CACHE_DIR)).toBe(true);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = generateCacheKey('test', 'input');
      const key2 = generateCacheKey('test', 'input');

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = generateCacheKey('test', 'input1');
      const key2 = generateCacheKey('test', 'input2');

      expect(key1).not.toBe(key2);
    });

    it('should handle object inputs', () => {
      const key = generateCacheKey({ foo: 'bar' }, { baz: 123 });
      expect(key).toBeDefined();
      expect(key.length).toBe(16);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', async () => {
      await cache.set('test-key', { value: 'test data' });
      const result = await cache.get<{ value: string }>('test-key');

      expect(result).toEqual({ value: 'test data' });
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');

      expect(result).toBeNull();
    });

    it('should store metadata', async () => {
      await cache.set('with-meta', 'data', undefined, { source: 'test' });
      const result = await cache.get('with-meta');

      expect(result).toBe('data');
    });

    it('should persist to disk', async () => {
      await cache.set('disk-test', 'persisted value');

      const files = await readdir(TEST_CACHE_DIR);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      expect(cacheFiles.length).toBeGreaterThan(0);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      // Set with 1 second TTL
      await cache.set('expiring', 'value', 1);

      // Should exist immediately
      const immediate = await cache.get('expiring');
      expect(immediate).toBe('value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const expired = await cache.get('expiring');
      expect(expired).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await cache.set('exists', 'value');

      expect(await cache.has('exists')).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      expect(await cache.has('not-exists')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove cache entry', async () => {
      await cache.set('to-delete', 'value');
      expect(await cache.has('to-delete')).toBe(true);

      await cache.delete('to-delete');
      expect(await cache.has('to-delete')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cache.set('stat1', 'value1');
      await cache.set('stat2', 'value2');

      const stats = await cache.getStats();

      expect(stats.memoryEntries).toBeGreaterThanOrEqual(2);
      expect(stats.diskEntries).toBeGreaterThanOrEqual(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if exists', async () => {
      await cache.set('computed', 'cached value');

      let computed = false;
      const result = await cache.getOrCompute('computed', async () => {
        computed = true;
        return 'new value';
      });

      expect(result).toBe('cached value');
      expect(computed).toBe(false);
    });

    it('should compute and cache if not exists', async () => {
      let computeCount = 0;
      const compute = async () => {
        computeCount++;
        return `computed-${computeCount}`;
      };

      const result1 = await cache.getOrCompute('new-key', compute);
      const result2 = await cache.getOrCompute('new-key', compute);

      expect(result1).toBe('computed-1');
      expect(result2).toBe('computed-1'); // Same value, computed once
      expect(computeCount).toBe(1);
    });

    it('should use custom TTL', async () => {
      const result = await cache.getOrCompute(
        'ttl-test',
        async () => 'value',
        1,
        { source: 'test' }
      );

      expect(result).toBe('value');
    });
  });

  describe('multiple data types', () => {
    it('should handle strings', async () => {
      await cache.set('string', 'hello world');
      expect(await cache.get('string')).toBe('hello world');
    });

    it('should handle numbers', async () => {
      await cache.set('number', 42);
      expect(await cache.get('number')).toBe(42);
    });

    it('should handle arrays', async () => {
      await cache.set('array', [1, 2, 3]);
      expect(await cache.get('array')).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', async () => {
      const obj = { a: { b: { c: 'deep' } } };
      await cache.set('nested', obj);
      expect(await cache.get('nested')).toEqual(obj);
    });
  });
});
