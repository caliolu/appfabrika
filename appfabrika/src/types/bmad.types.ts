/**
 * BMAD Types
 * Defines types for BMAD workflow steps and responses
 */

import type { LLMProvider } from './config.types.js';

/**
 * BMAD workflow step identifiers
 * Based on Architecture pattern: step-XX-name
 */
export enum BmadStepType {
  BRAINSTORMING = 'step-01-brainstorming',
  RESEARCH = 'step-02-research',
  PRODUCT_BRIEF = 'step-03-product-brief',
  PRD = 'step-04-prd',
  UX_DESIGN = 'step-05-ux-design',
  ARCHITECTURE = 'step-06-architecture',
  EPICS_STORIES = 'step-07-epics-stories',
  SPRINT_PLANNING = 'step-08-sprint-planning',
  TECH_SPEC = 'step-09-tech-spec',
  DEVELOPMENT = 'step-10-development',
  CODE_REVIEW = 'step-11-code-review',
  QA_TESTING = 'step-12-qa-testing',
}

/**
 * Display names for BMAD steps (Turkish)
 */
export const BMAD_STEP_NAMES: Record<BmadStepType, string> = {
  [BmadStepType.BRAINSTORMING]: 'Fikir Geliştirme',
  [BmadStepType.RESEARCH]: 'Araştırma',
  [BmadStepType.PRODUCT_BRIEF]: 'Ürün Özeti',
  [BmadStepType.PRD]: 'Gereksinimler',
  [BmadStepType.UX_DESIGN]: 'UX Tasarımı',
  [BmadStepType.ARCHITECTURE]: 'Mimari',
  [BmadStepType.EPICS_STORIES]: 'Epic ve Hikayeler',
  [BmadStepType.SPRINT_PLANNING]: 'Sprint Planlama',
  [BmadStepType.TECH_SPEC]: 'Teknik Şartname',
  [BmadStepType.DEVELOPMENT]: 'Geliştirme',
  [BmadStepType.CODE_REVIEW]: 'Kod İnceleme',
  [BmadStepType.QA_TESTING]: 'Test',
};

/**
 * Emojis for BMAD steps (for terminal display)
 */
export const BMAD_STEP_EMOJIS: Record<BmadStepType, string> = {
  [BmadStepType.BRAINSTORMING]: '💡',
  [BmadStepType.RESEARCH]: '🔍',
  [BmadStepType.PRODUCT_BRIEF]: '📋',
  [BmadStepType.PRD]: '📄',
  [BmadStepType.UX_DESIGN]: '🎨',
  [BmadStepType.ARCHITECTURE]: '🏗️',
  [BmadStepType.EPICS_STORIES]: '📝',
  [BmadStepType.SPRINT_PLANNING]: '📅',
  [BmadStepType.TECH_SPEC]: '🔧',
  [BmadStepType.DEVELOPMENT]: '💻',
  [BmadStepType.CODE_REVIEW]: '🔎',
  [BmadStepType.QA_TESTING]: '✅',
};

/**
 * Short descriptions for BMAD steps (Turkish)
 */
export const BMAD_STEP_DESCRIPTIONS: Record<BmadStepType, string> = {
  [BmadStepType.BRAINSTORMING]: 'Proje fikrini analiz ediyor...',
  [BmadStepType.RESEARCH]: 'Pazar ve teknik araştırma yapıyor...',
  [BmadStepType.PRODUCT_BRIEF]: 'Ürün özeti oluşturuyor...',
  [BmadStepType.PRD]: 'Gereksinim dokümanı hazırlıyor...',
  [BmadStepType.UX_DESIGN]: 'Kullanıcı deneyimi tasarlıyor...',
  [BmadStepType.ARCHITECTURE]: 'Teknik mimari planlıyor...',
  [BmadStepType.EPICS_STORIES]: 'Epic ve hikayeler oluşturuyor...',
  [BmadStepType.SPRINT_PLANNING]: 'Sprint planı hazırlıyor...',
  [BmadStepType.TECH_SPEC]: 'Teknik şartname yazıyor...',
  [BmadStepType.DEVELOPMENT]: 'Kod geliştiriyor...',
  [BmadStepType.CODE_REVIEW]: 'Kod incelemesi yapıyor...',
  [BmadStepType.QA_TESTING]: 'Test ve kalite kontrolü yapıyor...',
};

/**
 * All BMAD steps in order
 */
export const BMAD_STEPS = Object.values(BmadStepType);

/**
 * A section extracted from LLM response
 */
export interface BmadSection {
  /** Section heading (without #) */
  title: string;
  /** Heading level (1-6) */
  level: number;
  /** Section content (markdown) */
  content: string;
  /** Start line in original content */
  startLine: number;
  /** End line in original content */
  endLine: number;
}

/**
 * Metadata about the response
 */
export interface BmadResponseMetadata {
  /** When the response was created */
  createdAt: string;
  /** LLM provider that generated the response */
  provider: LLMProvider;
  /** Model used for generation */
  model: string;
}

/**
 * Validation result for a BMAD response
 */
export interface BmadValidationResult {
  /** Whether the response is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
}

/**
 * Structured BMAD response after transformation
 */
export interface BmadResponse {
  /** Type of BMAD step */
  stepType: BmadStepType;
  /** Original raw content from LLM */
  rawContent: string;
  /** Extracted sections */
  sections: BmadSection[];
  /** Response metadata */
  metadata: BmadResponseMetadata;
  /** Validation result */
  validation: BmadValidationResult;
}

/**
 * Required sections for each BMAD step
 * Empty array means no specific sections required
 */
export const REQUIRED_SECTIONS: Record<BmadStepType, string[]> = {
  [BmadStepType.BRAINSTORMING]: [],
  [BmadStepType.RESEARCH]: [],
  [BmadStepType.PRODUCT_BRIEF]: [],
  [BmadStepType.PRD]: [],
  [BmadStepType.UX_DESIGN]: [],
  [BmadStepType.ARCHITECTURE]: [],
  [BmadStepType.EPICS_STORIES]: [],
  [BmadStepType.SPRINT_PLANNING]: [],
  [BmadStepType.TECH_SPEC]: [],
  [BmadStepType.DEVELOPMENT]: [],
  [BmadStepType.CODE_REVIEW]: [],
  [BmadStepType.QA_TESTING]: [],
};
