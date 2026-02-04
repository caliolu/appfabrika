/**
 * BMAD Document Manager
 * Manages output documents with frontmatter tracking
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { logger } from './logger.js';

/**
 * Document frontmatter structure
 */
export interface DocumentFrontmatter {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  stepsCompleted: number[];
  currentStep?: number;
  inputDocuments?: string[];
  workflowId?: string;
  status: 'in-progress' | 'completed' | 'paused';
  [key: string]: unknown;
}

/**
 * Document state
 */
export interface DocumentState {
  path: string;
  frontmatter: DocumentFrontmatter;
  content: string;
  exists: boolean;
}

/**
 * Parse frontmatter from document content
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  try {
    const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

/**
 * Serialize frontmatter and content back to document
 */
export function serializeDocument(frontmatter: Record<string, unknown>, body: string): string {
  const yamlContent = stringifyYaml(frontmatter, { lineWidth: 0 });
  return `---\n${yamlContent}---\n\n${body}`;
}

/**
 * Document Manager class
 */
export class DocumentManager {
  private documents: Map<string, DocumentState> = new Map();

  /**
   * Load or create a document
   */
  async loadDocument(path: string): Promise<DocumentState> {
    // Check cache first
    if (this.documents.has(path)) {
      return this.documents.get(path)!;
    }

    if (existsSync(path)) {
      const content = await readFile(path, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);

      const state: DocumentState = {
        path,
        frontmatter: {
          name: (frontmatter.name as string) || '',
          createdAt: (frontmatter.createdAt as string) || new Date().toISOString(),
          updatedAt: (frontmatter.updatedAt as string) || new Date().toISOString(),
          stepsCompleted: (frontmatter.stepsCompleted as number[]) || [],
          currentStep: frontmatter.currentStep as number | undefined,
          inputDocuments: frontmatter.inputDocuments as string[] | undefined,
          workflowId: frontmatter.workflowId as string | undefined,
          status: (frontmatter.status as DocumentFrontmatter['status']) || 'in-progress',
          ...frontmatter,
        },
        content: body,
        exists: true,
      };

      this.documents.set(path, state);
      logger.debug('Document loaded', { path, stepsCompleted: state.frontmatter.stepsCompleted });

      return state;
    }

    // Create new document state
    const state: DocumentState = {
      path,
      frontmatter: {
        name: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stepsCompleted: [],
        status: 'in-progress',
      },
      content: '',
      exists: false,
    };

    this.documents.set(path, state);
    return state;
  }

  /**
   * Create document from template
   */
  async createFromTemplate(
    outputPath: string,
    templatePath: string,
    variables: Record<string, string>
  ): Promise<DocumentState> {
    // Read template
    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    let templateContent = await readFile(templatePath, 'utf-8');

    // Resolve variables in template
    for (const [key, value] of Object.entries(variables)) {
      const patterns = [
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        new RegExp(`\\{${key}\\}`, 'g'),
      ];
      for (const pattern of patterns) {
        templateContent = templateContent.replace(pattern, value);
      }
    }

    // Parse template frontmatter
    const { frontmatter: templateFm, body } = parseFrontmatter(templateContent);

    // Create new frontmatter
    const frontmatter: DocumentFrontmatter = {
      name: (templateFm.name as string) || variables.project_name || '',
      description: templateFm.description as string,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stepsCompleted: [],
      status: 'in-progress',
      ...templateFm,
    };

    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Write document
    const content = serializeDocument(frontmatter, body);
    await writeFile(outputPath, content, 'utf-8');

    const state: DocumentState = {
      path: outputPath,
      frontmatter,
      content: body,
      exists: true,
    };

    this.documents.set(outputPath, state);
    logger.info('Document created from template', { outputPath, templatePath });

    return state;
  }

  /**
   * Mark step as completed
   */
  async completeStep(path: string, stepNumber: number): Promise<void> {
    const state = await this.loadDocument(path);

    if (!state.frontmatter.stepsCompleted.includes(stepNumber)) {
      state.frontmatter.stepsCompleted.push(stepNumber);
      state.frontmatter.stepsCompleted.sort((a, b) => a - b);
    }

    state.frontmatter.updatedAt = new Date().toISOString();
    state.frontmatter.currentStep = stepNumber + 1;

    await this.saveDocument(path);
    logger.debug('Step marked completed', { path, stepNumber });
  }

  /**
   * Get last completed step
   */
  async getLastCompletedStep(path: string): Promise<number> {
    const state = await this.loadDocument(path);
    const completed = state.frontmatter.stepsCompleted;
    return completed.length > 0 ? Math.max(...completed) : 0;
  }

  /**
   * Check if step is completed
   */
  async isStepCompleted(path: string, stepNumber: number): Promise<boolean> {
    const state = await this.loadDocument(path);
    return state.frontmatter.stepsCompleted.includes(stepNumber);
  }

  /**
   * Add input document reference
   */
  async addInputDocument(path: string, inputPath: string): Promise<void> {
    const state = await this.loadDocument(path);

    if (!state.frontmatter.inputDocuments) {
      state.frontmatter.inputDocuments = [];
    }

    if (!state.frontmatter.inputDocuments.includes(inputPath)) {
      state.frontmatter.inputDocuments.push(inputPath);
    }

    state.frontmatter.updatedAt = new Date().toISOString();
    await this.saveDocument(path);
  }

  /**
   * Append content to document
   */
  async appendContent(path: string, content: string, sectionTitle?: string): Promise<void> {
    const state = await this.loadDocument(path);

    if (sectionTitle) {
      state.content += `\n\n## ${sectionTitle}\n\n${content}`;
    } else {
      state.content += `\n\n${content}`;
    }

    state.frontmatter.updatedAt = new Date().toISOString();
    await this.saveDocument(path);
  }

  /**
   * Replace placeholder in document
   */
  async replacePlaceholder(path: string, placeholder: string, content: string): Promise<void> {
    const state = await this.loadDocument(path);

    // Try different placeholder formats
    const patterns = [
      new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'),
      new RegExp(`\\[${placeholder}\\]`, 'g'),
      new RegExp(`<!-- ${placeholder} -->`, 'g'),
    ];

    for (const pattern of patterns) {
      state.content = state.content.replace(pattern, content);
    }

    state.frontmatter.updatedAt = new Date().toISOString();
    await this.saveDocument(path);
  }

  /**
   * Mark document as completed
   */
  async markCompleted(path: string): Promise<void> {
    const state = await this.loadDocument(path);
    state.frontmatter.status = 'completed';
    state.frontmatter.updatedAt = new Date().toISOString();
    await this.saveDocument(path);
    logger.info('Document marked completed', { path });
  }

  /**
   * Save document to disk
   */
  async saveDocument(path: string): Promise<void> {
    const state = this.documents.get(path);
    if (!state) {
      throw new Error(`Document not loaded: ${path}`);
    }

    // Ensure directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const content = serializeDocument(state.frontmatter, state.content);
    await writeFile(path, content, 'utf-8');

    state.exists = true;
    logger.debug('Document saved', { path });
  }

  /**
   * Get document state
   */
  getDocument(path: string): DocumentState | undefined {
    return this.documents.get(path);
  }

  /**
   * Check if can resume from existing document
   */
  async canResume(path: string): Promise<{ canResume: boolean; lastStep: number }> {
    if (!existsSync(path)) {
      return { canResume: false, lastStep: 0 };
    }

    const state = await this.loadDocument(path);
    const lastStep = this.getLastCompletedStepSync(state);

    return {
      canResume: lastStep > 0 && state.frontmatter.status !== 'completed',
      lastStep,
    };
  }

  private getLastCompletedStepSync(state: DocumentState): number {
    const completed = state.frontmatter.stepsCompleted;
    return completed.length > 0 ? Math.max(...completed) : 0;
  }
}

// Singleton instance
export const documentManager = new DocumentManager();
