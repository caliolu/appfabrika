/**
 * BMAD Step Registry
 * Registry of all 12 BMAD workflow steps with handlers
 */

import { BmadStepType, BMAD_STEPS, BMAD_STEP_NAMES } from '../types/bmad.types.js';
import {
  StepCategory,
  REGISTRY_ERRORS,
  type StepDefinition,
  type StepHandler,
  type StepInput,
  type StepContext,
  type StepOutput,
} from '../types/step.types.js';

/**
 * Step category mapping
 */
const STEP_CATEGORIES: Record<BmadStepType, StepCategory> = {
  [BmadStepType.BRAINSTORMING]: StepCategory.BUSINESS,
  [BmadStepType.RESEARCH]: StepCategory.BUSINESS,
  [BmadStepType.PRODUCT_BRIEF]: StepCategory.BUSINESS,
  [BmadStepType.PRD]: StepCategory.BUSINESS,
  [BmadStepType.UX_DESIGN]: StepCategory.DESIGN,
  [BmadStepType.ARCHITECTURE]: StepCategory.DESIGN,
  [BmadStepType.EPICS_STORIES]: StepCategory.DESIGN,
  [BmadStepType.SPRINT_PLANNING]: StepCategory.TECHNICAL,
  [BmadStepType.TECH_SPEC]: StepCategory.TECHNICAL,
  [BmadStepType.DEVELOPMENT]: StepCategory.TECHNICAL,
  [BmadStepType.CODE_REVIEW]: StepCategory.TECHNICAL,
  [BmadStepType.QA_TESTING]: StepCategory.TECHNICAL,
};

/**
 * Step descriptions in Turkish
 */
const STEP_DESCRIPTIONS: Record<BmadStepType, string> = {
  [BmadStepType.BRAINSTORMING]: 'Proje fikri üzerinde beyin fırtınası yapılır',
  [BmadStepType.RESEARCH]: 'Pazar, teknik ve alan araştırması yapılır',
  [BmadStepType.PRODUCT_BRIEF]: 'Ürün özeti ve vizyonu belirlenir',
  [BmadStepType.PRD]: 'Detaylı gereksinimler dokümanı oluşturulur',
  [BmadStepType.UX_DESIGN]: 'Kullanıcı deneyimi tasarlanır',
  [BmadStepType.ARCHITECTURE]: 'Sistem mimarisi tasarlanır',
  [BmadStepType.EPICS_STORIES]: 'Epic ve kullanıcı hikayeleri oluşturulur',
  [BmadStepType.SPRINT_PLANNING]: 'Sprint planlaması yapılır',
  [BmadStepType.TECH_SPEC]: 'Teknik şartname hazırlanır',
  [BmadStepType.DEVELOPMENT]: 'Kod geliştirme yapılır',
  [BmadStepType.CODE_REVIEW]: 'Kod incelemesi yapılır',
  [BmadStepType.QA_TESTING]: 'Test ve kalite kontrolü yapılır',
};

/**
 * Step dependencies - which steps must complete before
 */
const STEP_DEPENDENCIES: Partial<Record<BmadStepType, BmadStepType[]>> = {
  [BmadStepType.RESEARCH]: [BmadStepType.BRAINSTORMING],
  [BmadStepType.PRODUCT_BRIEF]: [BmadStepType.BRAINSTORMING, BmadStepType.RESEARCH],
  [BmadStepType.PRD]: [BmadStepType.PRODUCT_BRIEF],
  [BmadStepType.UX_DESIGN]: [BmadStepType.PRD],
  [BmadStepType.ARCHITECTURE]: [BmadStepType.PRD],
  [BmadStepType.EPICS_STORIES]: [BmadStepType.PRD, BmadStepType.ARCHITECTURE],
  [BmadStepType.SPRINT_PLANNING]: [BmadStepType.EPICS_STORIES],
  [BmadStepType.TECH_SPEC]: [BmadStepType.ARCHITECTURE, BmadStepType.EPICS_STORIES],
  [BmadStepType.DEVELOPMENT]: [BmadStepType.TECH_SPEC],
  [BmadStepType.CODE_REVIEW]: [BmadStepType.DEVELOPMENT],
  [BmadStepType.QA_TESTING]: [BmadStepType.DEVELOPMENT],
};

/**
 * Default placeholder handler for steps
 */
const createPlaceholderHandler = (stepId: BmadStepType): StepHandler => {
  return async (_input: StepInput, _context: StepContext): Promise<StepOutput> => {
    return {
      content: `Placeholder output for ${stepId}`,
      metadata: { placeholder: true },
    };
  };
};

/**
 * Registry for BMAD workflow steps
 * Manages step definitions and handlers
 */
export class BmadStepRegistry {
  private steps: Map<BmadStepType, StepDefinition>;
  private handlers: Map<BmadStepType, StepHandler>;

  /**
   * Create a new step registry with all 12 BMAD steps registered
   */
  constructor() {
    this.steps = new Map();
    this.handlers = new Map();

    // Register all default steps
    this.registerDefaultSteps();
  }

  /**
   * Register a step definition
   * @param definition - The step definition to register
   * @throws Error if step already exists or definition is invalid
   */
  registerStep(definition: StepDefinition): void {
    // Validate required fields
    if (!definition.id) {
      throw new Error(
        REGISTRY_ERRORS.INVALID_STEP_DEFINITION.replace('{field}', 'id')
      );
    }
    if (!definition.name) {
      throw new Error(
        REGISTRY_ERRORS.INVALID_STEP_DEFINITION.replace('{field}', 'name')
      );
    }
    if (!definition.templatePath) {
      throw new Error(
        REGISTRY_ERRORS.INVALID_STEP_DEFINITION.replace('{field}', 'templatePath')
      );
    }

    // Check for duplicates
    if (this.steps.has(definition.id)) {
      throw new Error(
        REGISTRY_ERRORS.STEP_ALREADY_EXISTS.replace('{stepId}', definition.id)
      );
    }

    this.steps.set(definition.id, definition);

    // Register handler if provided
    if (definition.handler) {
      this.handlers.set(definition.id, definition.handler);
    }
  }

  /**
   * Register a handler for a step
   * @param stepId - The step to register handler for
   * @param handler - The handler function
   * @throws Error if step not found
   */
  registerHandler(stepId: BmadStepType, handler: StepHandler): void {
    if (!this.steps.has(stepId)) {
      throw new Error(
        REGISTRY_ERRORS.STEP_NOT_FOUND.replace('{stepId}', stepId)
      );
    }
    this.handlers.set(stepId, handler);
  }

  /**
   * Get a step definition by ID
   * @param stepId - The step ID to look up
   * @returns The step definition
   * @throws Error if step not found
   */
  getStep(stepId: BmadStepType): StepDefinition {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new Error(
        REGISTRY_ERRORS.STEP_NOT_FOUND.replace('{stepId}', stepId)
      );
    }
    return { ...step };
  }

  /**
   * Get a handler for a step
   * @param stepId - The step ID to get handler for
   * @returns The step handler
   * @throws Error if handler not found
   */
  getHandler(stepId: BmadStepType): StepHandler {
    const handler = this.handlers.get(stepId);
    if (!handler) {
      throw new Error(
        REGISTRY_ERRORS.HANDLER_NOT_FOUND.replace('{stepId}', stepId)
      );
    }
    return handler;
  }

  /**
   * Get all steps in order
   * @returns Array of all step definitions in order (1-12)
   */
  getAllSteps(): StepDefinition[] {
    return BMAD_STEPS.map((stepId) => {
      const step = this.steps.get(stepId);
      return step ? { ...step } : this.createDefaultStepDefinition(stepId);
    });
  }

  /**
   * Get steps by category
   * @param category - The category to filter by
   * @returns Array of step definitions in that category
   */
  getStepsByCategory(category: StepCategory): StepDefinition[] {
    return this.getAllSteps().filter((step) => step.category === category);
  }

  /**
   * Check if a step is registered
   * @param stepId - The step ID to check
   * @returns true if the step exists
   */
  hasStep(stepId: BmadStepType): boolean {
    return this.steps.has(stepId);
  }

  /**
   * Check if a handler is registered for a step
   * @param stepId - The step ID to check
   * @returns true if a handler exists
   */
  hasHandler(stepId: BmadStepType): boolean {
    return this.handlers.has(stepId);
  }

  /**
   * Get the number of registered steps
   * @returns The count of registered steps
   */
  get size(): number {
    return this.steps.size;
  }

  /**
   * Register all default BMAD steps
   */
  private registerDefaultSteps(): void {
    for (const stepId of BMAD_STEPS) {
      const definition = this.createDefaultStepDefinition(stepId);
      this.steps.set(stepId, definition);
      this.handlers.set(stepId, createPlaceholderHandler(stepId));
    }
  }

  /**
   * Create a default step definition
   */
  private createDefaultStepDefinition(stepId: BmadStepType): StepDefinition {
    return {
      id: stepId,
      name: BMAD_STEP_NAMES[stepId],
      description: STEP_DESCRIPTIONS[stepId],
      category: STEP_CATEGORIES[stepId],
      templatePath: `templates/${stepId}.md`,
      requiredInputs: STEP_DEPENDENCIES[stepId],
    };
  }
}

/**
 * Singleton instance
 */
let instance: BmadStepRegistry | null = null;

/**
 * Get the singleton BmadStepRegistry instance
 * @returns The BmadStepRegistry instance
 */
export function getBmadStepRegistry(): BmadStepRegistry {
  if (!instance) {
    instance = new BmadStepRegistry();
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBmadStepRegistry(): void {
  instance = null;
}
