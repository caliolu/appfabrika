/**
 * BMAD Step Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BmadStepRegistry,
  getBmadStepRegistry,
  resetBmadStepRegistry,
} from '../../src/services/bmad-step-registry.js';
import { BmadStepType, BMAD_STEPS, BMAD_STEP_NAMES } from '../../src/types/bmad.types.js';
import {
  StepCategory,
  type StepDefinition,
  type StepHandler,
} from '../../src/types/step.types.js';

describe('BmadStepRegistry', () => {
  let registry: BmadStepRegistry;

  beforeEach(() => {
    resetBmadStepRegistry();
    registry = new BmadStepRegistry();
  });

  describe('initialization', () => {
    it('should register all 12 BMAD steps', () => {
      expect(registry.size).toBe(12);
    });

    it('should have all steps in order', () => {
      const steps = registry.getAllSteps();
      expect(steps).toHaveLength(12);
      expect(steps[0].id).toBe(BmadStepType.BRAINSTORMING);
      expect(steps[11].id).toBe(BmadStepType.QA_TESTING);
    });

    it('should have Turkish names for all steps', () => {
      const steps = registry.getAllSteps();
      steps.forEach((step) => {
        expect(step.name).toBe(BMAD_STEP_NAMES[step.id]);
      });
    });

    it('should have placeholder handlers for all steps', () => {
      for (const stepId of BMAD_STEPS) {
        expect(registry.hasHandler(stepId)).toBe(true);
      }
    });
  });

  describe('getStep', () => {
    it('should return step definition for valid step', () => {
      const step = registry.getStep(BmadStepType.BRAINSTORMING);
      expect(step.id).toBe(BmadStepType.BRAINSTORMING);
      expect(step.name).toBe('Fikir Geliştirme');
      expect(step.category).toBe(StepCategory.BUSINESS);
    });

    it('should throw error for invalid step', () => {
      expect(() => {
        registry.getStep('invalid-step' as BmadStepType);
      }).toThrow('Adım bulunamadı');
    });

    it('should return immutable copies', () => {
      const step1 = registry.getStep(BmadStepType.BRAINSTORMING);
      const step2 = registry.getStep(BmadStepType.BRAINSTORMING);
      expect(step1).not.toBe(step2);
      expect(step1).toEqual(step2);
    });
  });

  describe('getAllSteps', () => {
    it('should return steps in correct order', () => {
      const steps = registry.getAllSteps();

      expect(steps[0].id).toBe(BmadStepType.BRAINSTORMING);
      expect(steps[1].id).toBe(BmadStepType.RESEARCH);
      expect(steps[2].id).toBe(BmadStepType.PRODUCT_BRIEF);
      expect(steps[3].id).toBe(BmadStepType.PRD);
      expect(steps[4].id).toBe(BmadStepType.UX_DESIGN);
      expect(steps[5].id).toBe(BmadStepType.ARCHITECTURE);
      expect(steps[6].id).toBe(BmadStepType.EPICS_STORIES);
      expect(steps[7].id).toBe(BmadStepType.SPRINT_PLANNING);
      expect(steps[8].id).toBe(BmadStepType.TECH_SPEC);
      expect(steps[9].id).toBe(BmadStepType.DEVELOPMENT);
      expect(steps[10].id).toBe(BmadStepType.CODE_REVIEW);
      expect(steps[11].id).toBe(BmadStepType.QA_TESTING);
    });
  });

  describe('getStepsByCategory', () => {
    it('should return business steps (1-4)', () => {
      const steps = registry.getStepsByCategory(StepCategory.BUSINESS);
      expect(steps).toHaveLength(4);
      expect(steps.map(s => s.id)).toEqual([
        BmadStepType.BRAINSTORMING,
        BmadStepType.RESEARCH,
        BmadStepType.PRODUCT_BRIEF,
        BmadStepType.PRD,
      ]);
    });

    it('should return design steps (5-7)', () => {
      const steps = registry.getStepsByCategory(StepCategory.DESIGN);
      expect(steps).toHaveLength(3);
      expect(steps.map(s => s.id)).toEqual([
        BmadStepType.UX_DESIGN,
        BmadStepType.ARCHITECTURE,
        BmadStepType.EPICS_STORIES,
      ]);
    });

    it('should return technical steps (8-12)', () => {
      const steps = registry.getStepsByCategory(StepCategory.TECHNICAL);
      expect(steps).toHaveLength(5);
      expect(steps.map(s => s.id)).toEqual([
        BmadStepType.SPRINT_PLANNING,
        BmadStepType.TECH_SPEC,
        BmadStepType.DEVELOPMENT,
        BmadStepType.CODE_REVIEW,
        BmadStepType.QA_TESTING,
      ]);
    });
  });

  describe('step dependencies', () => {
    it('should have no dependencies for brainstorming', () => {
      const step = registry.getStep(BmadStepType.BRAINSTORMING);
      expect(step.requiredInputs).toBeUndefined();
    });

    it('should have brainstorming as dependency for research', () => {
      const step = registry.getStep(BmadStepType.RESEARCH);
      expect(step.requiredInputs).toContain(BmadStepType.BRAINSTORMING);
    });

    it('should have PRD as dependency for architecture', () => {
      const step = registry.getStep(BmadStepType.ARCHITECTURE);
      expect(step.requiredInputs).toContain(BmadStepType.PRD);
    });
  });

  describe('registerHandler', () => {
    it('should register custom handler', async () => {
      const customHandler: StepHandler = async () => ({
        content: 'Custom output',
        metadata: { custom: true },
      });

      registry.registerHandler(BmadStepType.BRAINSTORMING, customHandler);
      const handler = registry.getHandler(BmadStepType.BRAINSTORMING);

      const result = await handler(
        { prompt: 'test', previousOutputs: new Map() },
        { projectPath: '/test', automationMode: 'auto' as any, llmProvider: 'openai' }
      );

      expect(result.content).toBe('Custom output');
      expect(result.metadata?.custom).toBe(true);
    });

    it('should throw error for unregistered step', () => {
      const customHandler: StepHandler = async () => ({ content: 'test' });

      expect(() => {
        registry.registerHandler('invalid-step' as BmadStepType, customHandler);
      }).toThrow('Adım bulunamadı');
    });
  });

  describe('getHandler', () => {
    it('should return placeholder handler by default', async () => {
      const handler = registry.getHandler(BmadStepType.BRAINSTORMING);
      const result = await handler(
        { prompt: 'test', previousOutputs: new Map() },
        { projectPath: '/test', automationMode: 'auto' as any, llmProvider: 'openai' }
      );

      expect(result.content).toContain('Placeholder output');
      expect(result.metadata?.placeholder).toBe(true);
    });
  });

  describe('hasStep', () => {
    it('should return true for registered step', () => {
      expect(registry.hasStep(BmadStepType.BRAINSTORMING)).toBe(true);
    });

    it('should return false for unregistered step', () => {
      expect(registry.hasStep('invalid-step' as BmadStepType)).toBe(false);
    });
  });

  describe('hasHandler', () => {
    it('should return true when handler exists', () => {
      expect(registry.hasHandler(BmadStepType.BRAINSTORMING)).toBe(true);
    });
  });

  describe('registerStep', () => {
    it('should throw error for duplicate step', () => {
      const definition: StepDefinition = {
        id: BmadStepType.BRAINSTORMING,
        name: 'Duplicate',
        description: 'Test',
        category: StepCategory.BUSINESS,
        templatePath: 'test.md',
      };

      expect(() => {
        registry.registerStep(definition);
      }).toThrow('Adım zaten kayıtlı');
    });

    it('should throw error for missing id', () => {
      const definition = {
        name: 'Test',
        description: 'Test',
        category: StepCategory.BUSINESS,
        templatePath: 'test.md',
      } as StepDefinition;

      expect(() => {
        registry.registerStep(definition);
      }).toThrow('Geçersiz adım tanımı: id eksik');
    });

    it('should throw error for missing name', () => {
      const definition = {
        id: 'new-step' as BmadStepType,
        description: 'Test',
        category: StepCategory.BUSINESS,
        templatePath: 'test.md',
      } as StepDefinition;

      expect(() => {
        registry.registerStep(definition);
      }).toThrow('Geçersiz adım tanımı: name eksik');
    });

    it('should throw error for missing templatePath', () => {
      const definition = {
        id: 'new-step' as BmadStepType,
        name: 'Test',
        description: 'Test',
        category: StepCategory.BUSINESS,
      } as StepDefinition;

      expect(() => {
        registry.registerStep(definition);
      }).toThrow('Geçersiz adım tanımı: templatePath eksik');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getBmadStepRegistry();
      const instance2 = getBmadStepRegistry();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getBmadStepRegistry();
      resetBmadStepRegistry();
      const instance2 = getBmadStepRegistry();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('step template paths', () => {
    it('should have template path for each step', () => {
      const steps = registry.getAllSteps();
      steps.forEach((step) => {
        expect(step.templatePath).toBe(`templates/${step.id}.md`);
      });
    });
  });
});
