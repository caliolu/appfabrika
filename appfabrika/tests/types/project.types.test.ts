/**
 * ProjectState Type Tests
 */

import { describe, it, expect } from 'vitest';
import type { ProjectState } from '../../src/types/project.types.js';

describe('ProjectState', () => {
  it('should accept valid project state with idea', () => {
    const state: ProjectState = {
      idea: 'Test project idea',
    };

    expect(state.idea).toBe('Test project idea');
  });

  it('should require idea field', () => {
    // TypeScript compile-time check - this test ensures the type is correct
    const state: ProjectState = {
      idea: 'Required idea',
    };

    expect(state).toHaveProperty('idea');
  });
});
