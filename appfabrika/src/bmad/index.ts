/**
 * BMAD Module
 * Full BMAD methodology implementation with:
 * - Real workflow loading from _bmad folder
 * - Step-by-step execution with JIT loading
 * - Template system with {{placeholder}} resolution
 * - A/P/C/Y menu system
 * - Advanced Elicitation (50+ methods)
 * - YOLO mode
 * - Dynamic agent loading
 * - Quality gates and auto-fix
 * - Config loading from yaml
 * - Structured logging
 * - Token tracking and cost estimation
 * - Response caching
 * - Document management with frontmatter
 * - Input document discovery
 */

export * from './types.js';
export * from './parser.js';
export * from './executor.js';
export * from './orchestrator.js';
export * from './features.js';
export * from './advanced-features.js';
export * from './workflow-engine.js';
export * from './template-engine.js';
export * from './agent-loader.js';
export * from './config-loader.js';
export * from './logger.js';
export * from './token-tracker.js';
export * from './cache.js';

// Real BMAD modules
export * from './real-workflow-loader.js';
export * from './document-manager.js';
export * from './input-discovery.js';
export * from './real-step-executor.js';
