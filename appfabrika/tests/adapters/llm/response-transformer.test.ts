/**
 * Response Transformer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResponseTransformer,
  getResponseTransformer,
  resetResponseTransformer,
} from '../../../src/adapters/llm/response-transformer.js';
import { BmadStepType } from '../../../src/types/bmad.types.js';
import type { LLMResponse } from '../../../src/types/llm.types.js';

describe('ResponseTransformer', () => {
  let transformer: ResponseTransformer;

  beforeEach(() => {
    resetResponseTransformer();
    transformer = new ResponseTransformer();
  });

  describe('parseSections', () => {
    it('should parse markdown headings into sections', () => {
      const content = `# Heading 1
Content under heading 1

## Heading 2
Content under heading 2

### Heading 3
Content under heading 3`;

      const sections = transformer.parseSections(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].title).toBe('Heading 1');
      expect(sections[0].level).toBe(1);
      expect(sections[0].content).toContain('Content under heading 1');
      expect(sections[1].title).toBe('Heading 2');
      expect(sections[1].level).toBe(2);
      expect(sections[2].title).toBe('Heading 3');
      expect(sections[2].level).toBe(3);
    });

    it('should handle empty content', () => {
      const sections = transformer.parseSections('');
      expect(sections).toHaveLength(0);
    });

    it('should handle content without headings', () => {
      const content = `This is plain text
without any markdown headings.`;

      const sections = transformer.parseSections(content);
      expect(sections).toHaveLength(0);
    });

    it('should track line numbers', () => {
      const content = `# Section One
Line 2
Line 3

# Section Two
Line 6`;

      const sections = transformer.parseSections(content);

      expect(sections[0].startLine).toBe(0);
      expect(sections[0].endLine).toBe(3);
      expect(sections[1].startLine).toBe(4);
      expect(sections[1].endLine).toBe(5);
    });

    it('should handle multiple # in content', () => {
      const content = `# Main Heading
This contains code like \`### not a heading\`
And regular text`;

      const sections = transformer.parseSections(content);
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Main Heading');
    });
  });

  describe('validate', () => {
    it('should return valid for non-empty content', () => {
      const sections = transformer.parseSections('# Test\nSome content here that is long enough.');
      const result = transformer.validate(
        sections,
        BmadStepType.BRAINSTORMING,
        '# Test\nSome content here that is long enough.'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for empty content', () => {
      const result = transformer.validate(
        [],
        BmadStepType.BRAINSTORMING,
        ''
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Yanıt içeriği boş.');
    });

    it('should return invalid for whitespace-only content', () => {
      const result = transformer.validate(
        [],
        BmadStepType.BRAINSTORMING,
        '   \n\n  '
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Yanıt içeriği boş.');
    });

    it('should add warning for short content', () => {
      const result = transformer.validate(
        [],
        BmadStepType.BRAINSTORMING,
        'Short content'
      );

      expect(result.warnings).toContain('Yanıt çok kısa, daha detaylı içerik bekleniyor.');
    });

    it('should add warning when markdown headings not detected', () => {
      const content = '# Heading but no sections detected\nContent here is long enough to pass.';
      const result = transformer.validate(
        [], // Empty sections despite # in content
        BmadStepType.BRAINSTORMING,
        content
      );

      expect(result.warnings).toContain('Markdown başlıkları algılanamadı.');
    });
  });

  describe('transformResponse', () => {
    it('should transform LLM response to BMAD format', () => {
      const llmResponse: LLMResponse = {
        content: '# Fikir Geliştirme\n\nBu projede yapılacaklar çok fazla ve detaylı.',
        provider: 'openai',
        model: 'gpt-4',
      };

      const result = transformer.transformResponse(
        llmResponse,
        BmadStepType.BRAINSTORMING
      );

      expect(result.stepType).toBe(BmadStepType.BRAINSTORMING);
      expect(result.rawContent).toBe(llmResponse.content);
      expect(result.sections).toHaveLength(1);
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.model).toBe('gpt-4');
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.validation.isValid).toBe(true);
    });

    it('should include usage stats in metadata when available', () => {
      const llmResponse: LLMResponse = {
        content: '# Response\n\nThis is a test response with enough content to be valid.',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };

      const result = transformer.transformResponse(
        llmResponse,
        BmadStepType.RESEARCH
      );

      expect(result.metadata.provider).toBe('anthropic');
      expect(result.metadata.model).toBe('claude-3-5-sonnet-latest');
    });
  });

  describe('findSection', () => {
    it('should find section by exact title', () => {
      const sections = transformer.parseSections(`# Introduction
Intro content

# Details
Details content`);

      const result = transformer.findSection(sections, 'Details');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Details');
    });

    it('should find section by partial title match', () => {
      const sections = transformer.parseSections(`# Project Overview
Overview content`);

      const result = transformer.findSection(sections, 'Overview');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Project Overview');
    });

    it('should return undefined for non-existent section', () => {
      const sections = transformer.parseSections(`# Introduction
Content`);

      const result = transformer.findSection(sections, 'NonExistent');

      expect(result).toBeUndefined();
    });

    it('should handle Turkish characters', () => {
      const sections = transformer.parseSections(`# Özet
Özet içeriği`);

      const result = transformer.findSection(sections, 'Ozet');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Özet');
    });
  });

  describe('getSectionsByLevel', () => {
    it('should return sections at specified level', () => {
      const sections = transformer.parseSections(`# Level 1
Content

## Level 2a
Content

## Level 2b
Content

### Level 3
Content`);

      const level2 = transformer.getSectionsByLevel(sections, 2);

      expect(level2).toHaveLength(2);
      expect(level2[0].title).toBe('Level 2a');
      expect(level2[1].title).toBe('Level 2b');
    });

    it('should return empty array if no sections at level', () => {
      const sections = transformer.parseSections(`# Only Level 1
Content`);

      const level2 = transformer.getSectionsByLevel(sections, 2);

      expect(level2).toHaveLength(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getResponseTransformer();
      const instance2 = getResponseTransformer();

      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getResponseTransformer();
      resetResponseTransformer();
      const instance2 = getResponseTransformer();

      expect(instance1).not.toBe(instance2);
    });
  });
});
