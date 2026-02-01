/**
 * Response Transformer
 * Transforms LLM responses to structured BMAD format
 */

import type { LLMResponse } from '../../types/llm.types.js';
import type {
  BmadStepType,
  BmadSection,
  BmadResponse,
  BmadValidationResult,
} from '../../types/bmad.types.js';
import { REQUIRED_SECTIONS } from '../../types/bmad.types.js';

/**
 * Transforms raw LLM responses into structured BMAD format
 */
export class ResponseTransformer {
  /**
   * Transform an LLM response to BMAD format
   * @param llmResponse - Raw response from LLM
   * @param stepType - The BMAD step type for validation
   * @returns Structured BMAD response
   */
  transformResponse(
    llmResponse: LLMResponse,
    stepType: BmadStepType
  ): BmadResponse {
    const sections = this.parseSections(llmResponse.content);
    const validation = this.validate(sections, stepType, llmResponse.content);

    return {
      stepType,
      rawContent: llmResponse.content,
      sections,
      metadata: {
        createdAt: new Date().toISOString(),
        provider: llmResponse.provider,
        model: llmResponse.model,
      },
      validation,
    };
  }

  /**
   * Parse markdown content into sections
   * @param content - Raw markdown content
   * @returns Array of parsed sections
   */
  parseSections(content: string): BmadSection[] {
    const lines = content.split('\n');
    const sections: BmadSection[] = [];
    let currentSection: Partial<BmadSection> | null = null;
    let contentBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section if exists
        if (currentSection && currentSection.title) {
          sections.push({
            ...currentSection,
            content: contentBuffer.join('\n').trim(),
            endLine: i - 1,
          } as BmadSection);
        }

        // Start new section
        currentSection = {
          title: headingMatch[2].trim(),
          level: headingMatch[1].length,
          startLine: i,
        };
        contentBuffer = [];
      } else if (currentSection) {
        contentBuffer.push(line);
      }
    }

    // Save last section
    if (currentSection && currentSection.title) {
      sections.push({
        ...currentSection,
        content: contentBuffer.join('\n').trim(),
        endLine: lines.length - 1,
      } as BmadSection);
    }

    return sections;
  }

  /**
   * Validate response against step requirements
   * @param sections - Parsed sections
   * @param stepType - BMAD step type
   * @param rawContent - Original content for additional checks
   * @returns Validation result
   */
  validate(
    sections: BmadSection[],
    stepType: BmadStepType,
    rawContent: string
  ): BmadValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty content
    if (!rawContent || !rawContent.trim()) {
      errors.push('Yanıt içeriği boş.');
      return { isValid: false, errors, warnings };
    }

    // Check required sections for this step
    const requiredSections = REQUIRED_SECTIONS[stepType];
    const sectionTitles = sections.map((s) =>
      s.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    for (const required of requiredSections) {
      const normalizedRequired = required
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const found = sectionTitles.some(
        (title) =>
          title.includes(normalizedRequired) ||
          normalizedRequired.includes(title)
      );

      if (!found) {
        errors.push(`Gerekli bölüm eksik: ${required}`);
      }
    }

    // Check for minimum content length
    if (rawContent.trim().length < 50) {
      warnings.push('Yanıt çok kısa, daha detaylı içerik bekleniyor.');
    }

    // Check for at least one section in structured responses
    if (sections.length === 0 && rawContent.includes('#')) {
      warnings.push('Markdown başlıkları algılanamadı.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract a specific section by title
   * @param sections - Parsed sections
   * @param title - Section title to find
   * @returns The section if found, undefined otherwise
   */
  findSection(sections: BmadSection[], title: string): BmadSection | undefined {
    const normalizedTitle = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return sections.find((s) => {
      const normalizedSectionTitle = s.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      return (
        normalizedSectionTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(normalizedSectionTitle)
      );
    });
  }

  /**
   * Get all sections at a specific heading level
   * @param sections - Parsed sections
   * @param level - Heading level (1-6)
   * @returns Sections at the specified level
   */
  getSectionsByLevel(sections: BmadSection[], level: number): BmadSection[] {
    return sections.filter((s) => s.level === level);
  }
}

/**
 * Singleton instance for convenience
 */
let instance: ResponseTransformer | null = null;

export function getResponseTransformer(): ResponseTransformer {
  if (!instance) {
    instance = new ResponseTransformer();
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetResponseTransformer(): void {
  instance = null;
}
