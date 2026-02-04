/**
 * BMAD Input Document Discovery
 * Smart discovery of input documents (brainstorming, research, project-context, etc.)
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { glob } from 'glob';
import { logger } from './logger.js';
import type { BmadRealConfig } from './real-workflow-loader.js';

/**
 * Discovered document
 */
export interface DiscoveredDocument {
  path: string;
  name: string;
  type: DocumentType;
  content?: string;
  isSharded: boolean;
  shardFiles?: string[];
}

/**
 * Document types
 */
export type DocumentType =
  | 'brainstorming'
  | 'research'
  | 'product-brief'
  | 'prd'
  | 'architecture'
  | 'ux-design'
  | 'epics'
  | 'project-context'
  | 'unknown';

/**
 * Discovery result
 */
export interface DiscoveryResult {
  documents: DiscoveredDocument[];
  byType: Map<DocumentType, DiscoveredDocument[]>;
  totalLoaded: number;
}

/**
 * Document type patterns
 */
const TYPE_PATTERNS: Record<DocumentType, string[]> = {
  'brainstorming': ['*brainstorm*', '*ideation*', '*ideas*'],
  'research': ['*research*', '*analysis*', '*market*'],
  'product-brief': ['*product-brief*', '*brief*'],
  'prd': ['*prd*', '*requirements*', '*req*'],
  'architecture': ['*architect*', '*tech-spec*', '*design*'],
  'ux-design': ['*ux*', '*wireframe*', '*ui*'],
  'epics': ['*epic*', '*story*', '*stories*'],
  'project-context': ['*project-context*', '*context*', '*overview*'],
  'unknown': [],
};

/**
 * Detect document type from filename
 */
function detectDocumentType(filename: string): DocumentType {
  const lower = filename.toLowerCase();

  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      if (regex.test(lower)) {
        return type as DocumentType;
      }
    }
  }

  return 'unknown';
}

/**
 * Check if path is a sharded document (folder with index.md)
 */
async function isShardedDocument(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    if (!stats.isDirectory()) return false;

    const indexPath = join(path, 'index.md');
    return existsSync(indexPath);
  } catch {
    return false;
  }
}

/**
 * Load sharded document (all files in folder)
 */
async function loadShardedDocument(folderPath: string): Promise<{ content: string; files: string[] }> {
  const files: string[] = [];
  let content = '';

  // Load index.md first if exists
  const indexPath = join(folderPath, 'index.md');
  if (existsSync(indexPath)) {
    const indexContent = await readFile(indexPath, 'utf-8');
    content += `# Index\n\n${indexContent}\n\n---\n\n`;
    files.push(indexPath);
  }

  // Load other markdown files
  const allFiles = await readdir(folderPath);
  const mdFiles = allFiles
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .sort();

  for (const file of mdFiles) {
    const filePath = join(folderPath, file);
    const fileContent = await readFile(filePath, 'utf-8');
    content += `# ${basename(file, '.md')}\n\n${fileContent}\n\n---\n\n`;
    files.push(filePath);
  }

  return { content, files };
}

/**
 * Search for documents matching patterns
 */
async function searchDocuments(
  searchPaths: string[],
  patterns: string[]
): Promise<string[]> {
  const results: string[] = [];

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    for (const pattern of patterns) {
      try {
        // Search for files
        const filePattern = join(searchPath, '**', `${pattern}.md`);
        const files = await glob(filePattern, { nodir: true });
        results.push(...files);

        // Search for sharded folders
        const folderPattern = join(searchPath, '**', pattern);
        const folders = await glob(folderPattern, { onlyDirectories: true });

        for (const folder of folders) {
          if (await isShardedDocument(folder)) {
            results.push(folder);
          }
        }
      } catch {
        // Ignore glob errors
      }
    }
  }

  // Remove duplicates
  return [...new Set(results)];
}

/**
 * Input Discovery class
 */
export class InputDiscovery {
  private config: BmadRealConfig;
  private projectRoot: string;

  constructor(config: BmadRealConfig, projectRoot: string) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Discover all input documents
   */
  async discoverAll(): Promise<DiscoveryResult> {
    const documents: DiscoveredDocument[] = [];
    const byType = new Map<DocumentType, DiscoveredDocument[]>();

    // Search paths
    const searchPaths = [
      this.config.planning_artifacts,
      this.config.output_folder,
      this.config.project_knowledge,
      join(this.projectRoot, 'docs'),
    ].filter(p => p && existsSync(p));

    logger.debug('Searching for input documents', { searchPaths });

    // Search for each document type
    for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
      if (patterns.length === 0) continue;

      const paths = await searchDocuments(searchPaths, patterns);

      for (const path of paths) {
        const doc = await this.loadDocument(path);
        if (doc) {
          doc.type = type as DocumentType;
          documents.push(doc);

          if (!byType.has(doc.type)) {
            byType.set(doc.type, []);
          }
          byType.get(doc.type)!.push(doc);
        }
      }
    }

    logger.info('Input documents discovered', {
      total: documents.length,
      types: Object.fromEntries(
        Array.from(byType.entries()).map(([k, v]) => [k, v.length])
      ),
    });

    return {
      documents,
      byType,
      totalLoaded: documents.length,
    };
  }

  /**
   * Discover specific document types
   */
  async discoverByTypes(types: DocumentType[]): Promise<DiscoveryResult> {
    const documents: DiscoveredDocument[] = [];
    const byType = new Map<DocumentType, DiscoveredDocument[]>();

    const searchPaths = [
      this.config.planning_artifacts,
      this.config.output_folder,
      this.config.project_knowledge,
      join(this.projectRoot, 'docs'),
    ].filter(p => p && existsSync(p));

    for (const type of types) {
      const patterns = TYPE_PATTERNS[type] || [];
      if (patterns.length === 0) continue;

      const paths = await searchDocuments(searchPaths, patterns);

      for (const path of paths) {
        const doc = await this.loadDocument(path);
        if (doc) {
          doc.type = type;
          documents.push(doc);

          if (!byType.has(type)) {
            byType.set(type, []);
          }
          byType.get(type)!.push(doc);
        }
      }
    }

    return {
      documents,
      byType,
      totalLoaded: documents.length,
    };
  }

  /**
   * Load a single document (file or sharded folder)
   */
  async loadDocument(path: string): Promise<DiscoveredDocument | null> {
    try {
      const stats = await stat(path);

      if (stats.isDirectory()) {
        // Sharded document
        if (await isShardedDocument(path)) {
          const { content, files } = await loadShardedDocument(path);
          return {
            path,
            name: basename(path),
            type: detectDocumentType(basename(path)),
            content,
            isSharded: true,
            shardFiles: files,
          };
        }
        return null;
      }

      // Single file
      const content = await readFile(path, 'utf-8');
      return {
        path,
        name: basename(path, '.md'),
        type: detectDocumentType(basename(path)),
        content,
        isSharded: false,
      };
    } catch (error) {
      logger.warn('Failed to load document', { path, error });
      return null;
    }
  }

  /**
   * Find project context document
   */
  async findProjectContext(): Promise<DiscoveredDocument | null> {
    const possiblePaths = [
      join(this.projectRoot, 'project-context.md'),
      join(this.projectRoot, 'docs', 'project-context.md'),
      join(this.config.project_knowledge, 'project-context.md'),
      join(this.config.planning_artifacts, 'project-context.md'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return this.loadDocument(path);
      }
    }

    return null;
  }

  /**
   * Generate discovery report for user
   */
  generateReport(result: DiscoveryResult): string {
    const lines: string[] = ['**Input Documents Discovered:**\n'];

    for (const [type, docs] of result.byType.entries()) {
      lines.push(`- **${type}**: ${docs.length} document(s)`);
      for (const doc of docs) {
        const shardInfo = doc.isSharded ? ` (${doc.shardFiles?.length || 0} files)` : '';
        lines.push(`  - ${doc.name}${shardInfo}`);
      }
    }

    if (result.documents.length === 0) {
      lines.push('- No documents found');
    }

    lines.push(`\n**Total files loaded:** ${result.totalLoaded}`);

    return lines.join('\n');
  }
}

/**
 * Create input discovery instance
 */
export function createInputDiscovery(
  config: BmadRealConfig,
  projectRoot: string
): InputDiscovery {
  return new InputDiscovery(config, projectRoot);
}
