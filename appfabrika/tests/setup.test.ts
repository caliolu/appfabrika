import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Project Setup', () => {
  const projectRoot = resolve(__dirname, '..');

  describe('Package Configuration', () => {
    it('should have package.json with correct name', async () => {
      const pkg = await import('../package.json');
      expect(pkg.name).toBe('appfabrika');
    });

    it('should have package.json with ESM type', async () => {
      const pkg = await import('../package.json');
      expect(pkg.type).toBe('module');
    });

    it('should have correct bin configuration', async () => {
      const pkg = await import('../package.json');
      expect(pkg.bin).toHaveProperty('appfabrika');
    });

    it('should have required dependencies', async () => {
      const pkg = await import('../package.json');
      expect(pkg.dependencies).toHaveProperty('commander');
      expect(pkg.dependencies).toHaveProperty('@clack/prompts');
      expect(pkg.dependencies).toHaveProperty('ora');
      expect(pkg.dependencies).toHaveProperty('chalk');
      expect(pkg.dependencies).toHaveProperty('openai');
      expect(pkg.dependencies).toHaveProperty('@anthropic-ai/sdk');
    });

    it('should have required devDependencies', async () => {
      const pkg = await import('../package.json');
      expect(pkg.devDependencies).toHaveProperty('typescript');
      expect(pkg.devDependencies).toHaveProperty('tsup');
      expect(pkg.devDependencies).toHaveProperty('vitest');
      expect(pkg.devDependencies).toHaveProperty('@types/node');
    });
  });

  describe('TypeScript Configuration', () => {
    it('should have tsconfig.json', () => {
      expect(existsSync(resolve(projectRoot, 'tsconfig.json'))).toBe(true);
    });

    it('should have correct tsconfig settings', async () => {
      const tsconfig = await import('../tsconfig.json');
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.module).toBe('NodeNext');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    });
  });

  describe('Project Structure', () => {
    it('should have src/cli directory', () => {
      expect(existsSync(resolve(projectRoot, 'src/cli'))).toBe(true);
    });

    it('should have src/services directory', () => {
      expect(existsSync(resolve(projectRoot, 'src/services'))).toBe(true);
    });

    it('should have src/adapters directory', () => {
      expect(existsSync(resolve(projectRoot, 'src/adapters'))).toBe(true);
    });

    it('should have src/core directory', () => {
      expect(existsSync(resolve(projectRoot, 'src/core'))).toBe(true);
    });

    it('should have src/types directory', () => {
      expect(existsSync(resolve(projectRoot, 'src/types'))).toBe(true);
    });

    it('should have templates directory', () => {
      expect(existsSync(resolve(projectRoot, 'templates'))).toBe(true);
    });

    it('should have CLI entry point', () => {
      expect(existsSync(resolve(projectRoot, 'src/cli/index.ts'))).toBe(true);
    });
  });

  describe('Build Configuration', () => {
    it('should have tsup.config.ts', () => {
      expect(existsSync(resolve(projectRoot, 'tsup.config.ts'))).toBe(true);
    });

    it('should have vitest.config.ts', () => {
      expect(existsSync(resolve(projectRoot, 'vitest.config.ts'))).toBe(true);
    });
  });
});
