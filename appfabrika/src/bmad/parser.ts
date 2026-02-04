/**
 * BMAD Workflow Parser
 * Parses workflow.md and step-*.md files from _bmad folder
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type {
  WorkflowMeta,
  StepMeta,
  ParsedStep,
  ParsedWorkflow,
  StepSection,
  MenuOption,
  BmadPhase,
} from './types.js';

/**
 * Parse YAML-like frontmatter from markdown
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};

  const frontmatter: Record<string, string> = {};
  const lines = frontmatterMatch[1].split('\n');

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/**
 * Extract content after frontmatter
 */
function getContentAfterFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

/**
 * Parse sections from step content
 */
function parseSections(content: string): StepSection[] {
  const sections: StepSection[] = [];

  // Match numbered sections like "### 1. Title" or "## 1. Title"
  const sectionRegex = /#{2,3}\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=#{2,3}\s*\d+\.|$)/g;
  let match;

  while ((match = sectionRegex.exec(content)) !== null) {
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    const sectionContent = match[3].trim();

    // Extract questions (lines starting with - or *)
    const questions: string[] = [];
    const questionMatches = sectionContent.match(/^[-*]\s+(.+\?)/gm);
    if (questionMatches) {
      questions.push(...questionMatches.map(q => q.replace(/^[-*]\s+/, '')));
    }

    // Check if this is a menu section
    const isMenu = title.toLowerCase().includes('menu') ||
                   sectionContent.includes('[A]') ||
                   sectionContent.includes('[P]') ||
                   sectionContent.includes('[C]');

    sections.push({
      number,
      title,
      content: sectionContent,
      questions,
      isMenu,
    });
  }

  return sections;
}

/**
 * Parse menu options from content
 */
function parseMenuOptions(content: string): MenuOption[] {
  const options: MenuOption[] = [];

  // Match [A], [P], [C] style options
  const optionRegex = /\[([A-Z])\]\s*([^[\n]+)/g;
  let match;

  while ((match = optionRegex.exec(content)) !== null) {
    const key = match[1];
    const label = match[2].trim();

    let action: MenuOption['action'] = 'custom';
    if (key === 'A') action = 'advanced-elicitation';
    else if (key === 'P') action = 'party-mode';
    else if (key === 'C') action = 'continue';

    options.push({ key, label, action });
  }

  return options;
}

/**
 * Extract success metrics from content
 */
function extractSuccessMetrics(content: string): string[] {
  const metrics: string[] = [];
  const successSection = content.match(/## SUCCESS|### ✅ SUCCESS[\s\S]*?(?=##|$)/i);

  if (successSection) {
    const items = successSection[0].match(/[-✅]\s+(.+)/g);
    if (items) {
      metrics.push(...items.map(item => item.replace(/^[-✅]\s+/, '').trim()));
    }
  }

  return metrics;
}

/**
 * Extract failure modes from content
 */
function extractFailureModes(content: string): string[] {
  const modes: string[] = [];
  const failureSection = content.match(/## FAILURE|### ❌ SYSTEM FAILURE[\s\S]*?(?=##|$)/i);

  if (failureSection) {
    const items = failureSection[0].match(/[-❌]\s+(.+)/g);
    if (items) {
      modes.push(...items.map(item => item.replace(/^[-❌]\s+/, '').trim()));
    }
  }

  return modes;
}

/**
 * Extract step goal from content
 */
function extractGoal(content: string): string {
  const goalMatch = content.match(/## STEP GOAL:?\s*\n+([\s\S]*?)(?=\n##|\n###)/i);
  if (goalMatch) {
    return goalMatch[1].trim();
  }

  // Try alternative format
  const altMatch = content.match(/\*\*Goal:\*\*\s*(.+)/i);
  return altMatch ? altMatch[1].trim() : '';
}

/**
 * Parse a single step file
 */
export async function parseStepFile(filePath: string): Promise<ParsedStep> {
  const content = await readFile(filePath, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  const mainContent = getContentAfterFrontmatter(content);

  const meta: StepMeta = {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    nextStepFile: frontmatter.nextStepFile,
    outputFile: frontmatter.outputFile,
    advancedElicitationTask: frontmatter.advancedElicitationTask,
    partyModeWorkflow: frontmatter.partyModeWorkflow,
  };

  return {
    meta,
    goal: extractGoal(mainContent),
    sections: parseSections(mainContent),
    menuOptions: parseMenuOptions(mainContent),
    successMetrics: extractSuccessMetrics(mainContent),
    failureModes: extractFailureModes(mainContent),
  };
}

/**
 * Parse a workflow file and all its steps
 */
export async function parseWorkflow(
  workflowPath: string,
  bmadRoot: string
): Promise<ParsedWorkflow> {
  const workflowFile = join(bmadRoot, workflowPath, 'workflow.md');

  if (!existsSync(workflowFile)) {
    throw new Error(`Workflow file not found: ${workflowFile}`);
  }

  const content = await readFile(workflowFile, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  // Determine phase from path
  let phase: BmadPhase = 'analysis' as BmadPhase;
  if (workflowPath.includes('1-analysis')) phase = 'analysis' as BmadPhase;
  else if (workflowPath.includes('2-plan')) phase = 'planning' as BmadPhase;
  else if (workflowPath.includes('3-solutioning')) phase = 'solutioning' as BmadPhase;
  else if (workflowPath.includes('4-implementation')) phase = 'implementation' as BmadPhase;

  const meta: WorkflowMeta = {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    phase,
    order: 0,
    required: false,
    nextStep: frontmatter.nextStep,
    webBundle: frontmatter.web_bundle === 'true',
  };

  // Find and parse all step files
  const workflowDir = join(bmadRoot, workflowPath);
  const stepsDir = join(workflowDir, 'steps');
  const stepsCDir = join(workflowDir, 'steps-c'); // PRD create mode

  let stepsPath = stepsDir;
  if (!existsSync(stepsDir) && existsSync(stepsCDir)) {
    stepsPath = stepsCDir;
  }

  const steps: ParsedStep[] = [];

  if (existsSync(stepsPath)) {
    const files = await readdir(stepsPath);
    const stepFiles = files
      .filter(f => f.startsWith('step-') && f.endsWith('.md'))
      .sort((a, b) => {
        // Extract step number for sorting
        const numA = parseInt(a.match(/step-(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/step-(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    for (const file of stepFiles) {
      const stepPath = join(stepsPath, file);
      const step = await parseStepFile(stepPath);
      steps.push(step);
    }
  }

  return {
    meta,
    steps,
    currentStepIndex: 0,
  };
}

/**
 * Find BMAD root directory
 */
export async function findBmadRoot(startPath: string): Promise<string | null> {
  let currentPath = startPath;

  while (currentPath !== '/') {
    const bmadPath = join(currentPath, '_bmad');
    if (existsSync(bmadPath)) {
      return bmadPath;
    }
    currentPath = dirname(currentPath);
  }

  // Check common locations
  const commonPaths = [
    join(process.env.HOME || '', '_bmad'),
    join(startPath, '_bmad'),
    join(startPath, '..', '_bmad'),
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * List all available workflows from BMAD root
 */
export async function listWorkflows(bmadRoot: string): Promise<string[]> {
  const workflows: string[] = [];

  const bmmWorkflowsPath = join(bmadRoot, 'bmm', 'workflows');
  const coreWorkflowsPath = join(bmadRoot, 'core', 'workflows');

  // Scan BMM workflows
  if (existsSync(bmmWorkflowsPath)) {
    const phases = await readdir(bmmWorkflowsPath);
    for (const phase of phases) {
      const phasePath = join(bmmWorkflowsPath, phase);
      const stat = await readdir(phasePath).catch(() => []);
      for (const workflow of stat) {
        const workflowPath = join(phasePath, workflow, 'workflow.md');
        if (existsSync(workflowPath)) {
          workflows.push(`bmm/workflows/${phase}/${workflow}`);
        }
      }
    }
  }

  // Scan Core workflows
  if (existsSync(coreWorkflowsPath)) {
    const coreWorkflows = await readdir(coreWorkflowsPath);
    for (const workflow of coreWorkflows) {
      const workflowPath = join(coreWorkflowsPath, workflow, 'workflow.md');
      if (existsSync(workflowPath)) {
        workflows.push(`core/workflows/${workflow}`);
      }
    }
  }

  return workflows;
}
