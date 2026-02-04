/**
 * Real BMAD Workflow Loader
 * Loads workflows from actual _bmad folder structure
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { logger } from './logger.js';

/**
 * BMAD Config from config.yaml
 */
export interface BmadRealConfig {
  project_name: string;
  user_name: string;
  user_skill_level: string;
  communication_language: string;
  document_output_language: string;
  output_folder: string;
  planning_artifacts: string;
  implementation_artifacts: string;
  project_knowledge: string;
  [key: string]: string;
}

/**
 * Workflow definition from workflow.yaml/md
 */
export interface RealWorkflowDef {
  name: string;
  description: string;
  author?: string;
  configSource: string;
  installedPath: string;
  instructions?: string;
  validation?: string;
  template?: string;
  outputFile?: string;
  standalone?: boolean;
  webBundle?: boolean;
  // Resolved variables
  variables: Record<string, string>;
  // Path to workflow file
  workflowPath: string;
  // Phase (derived from folder structure)
  phase: string;
  phaseNumber: number;
}

/**
 * Step definition from step-XX-name.md
 */
export interface RealStepDef {
  name: string;
  description: string;
  nextStepFile?: string;
  outputFile?: string;
  templateRef?: string;
  goal: string;
  content: string;
  sections: StepSection[];
  // Full path to step file
  stepPath: string;
}

export interface StepSection {
  number: number;
  title: string;
  content: string;
  isMenu: boolean;
  isCritical: boolean;
}

/**
 * Discovery result for workflows
 */
export interface WorkflowDiscoveryResult {
  config: BmadRealConfig;
  workflows: RealWorkflowDef[];
  phases: Map<string, RealWorkflowDef[]>;
}

/**
 * Find BMAD root directory
 */
export async function findBmadRootReal(startPath: string): Promise<string | null> {
  let current = startPath;

  // Check common locations
  const possiblePaths = [
    join(current, '_bmad'),
    join(current, '..', '_bmad'),
    join(current, '..', '..', '_bmad'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path) && existsSync(join(path, 'bmm'))) {
      logger.debug('BMAD root found', { path });
      return path;
    }
  }

  return null;
}

/**
 * Load BMAD config from config.yaml
 */
export async function loadRealConfig(bmadRoot: string): Promise<BmadRealConfig> {
  const configPath = join(bmadRoot, 'bmm', 'config.yaml');

  if (!existsSync(configPath)) {
    throw new Error(`BMAD config not found: ${configPath}`);
  }

  const content = await readFile(configPath, 'utf-8');
  const parsed = parseYaml(content) as Record<string, string>;

  // Get project root (parent of _bmad)
  const projectRoot = dirname(bmadRoot);

  // Resolve {project-root} in all values
  const config: BmadRealConfig = {
    project_name: '',
    user_name: '',
    user_skill_level: 'intermediate',
    communication_language: 'turkish',
    document_output_language: 'turkish',
    output_folder: '',
    planning_artifacts: '',
    implementation_artifacts: '',
    project_knowledge: '',
  };

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      config[key] = value.replace(/\{project-root\}/g, projectRoot);
    } else {
      config[key] = String(value);
    }
  }

  logger.info('BMAD config loaded', {
    projectName: config.project_name,
    userName: config.user_name,
  });

  return config;
}

/**
 * Resolve variables in a string
 */
function resolveVariables(
  str: string,
  config: BmadRealConfig,
  localVars: Record<string, string>
): string {
  let result = str;

  // Replace {project-root}
  const projectRoot = dirname(dirname(localVars['installed_path'] || ''));
  result = result.replace(/\{project-root\}/g, projectRoot);

  // Replace {config_source}:variable
  result = result.replace(/\{config_source\}:(\w+)/g, (_, key) => {
    return config[key] || `{${key}}`;
  });

  // Replace {variable}
  result = result.replace(/\{(\w+)\}/g, (match, key) => {
    if (localVars[key]) return localVars[key];
    if (config[key]) return config[key];
    return match;
  });

  // Replace system-generated date
  if (result === 'system-generated') {
    result = new Date().toISOString().split('T')[0];
  }

  return result;
}

/**
 * Parse workflow.yaml file
 */
async function parseWorkflowYaml(
  filePath: string,
  config: BmadRealConfig,
  phase: string,
  phaseNumber: number
): Promise<RealWorkflowDef> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = parseYaml(content) as Record<string, unknown>;

  const workflowDir = dirname(filePath);
  const projectRoot = dirname(dirname(dirname(dirname(workflowDir))));

  // Build local variables
  const localVars: Record<string, string> = {
    'installed_path': workflowDir,
    'project-root': projectRoot,
  };

  // First pass - resolve basic paths
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      localVars[key] = resolveVariables(value, config, localVars);
    }
  }

  return {
    name: String(parsed.name || basename(workflowDir)),
    description: String(parsed.description || ''),
    author: parsed.author as string | undefined,
    configSource: localVars['config_source'] || '',
    installedPath: workflowDir,
    instructions: localVars['instructions'],
    validation: localVars['validation'],
    template: localVars['template'],
    outputFile: localVars['default_output_file'] || localVars['outputFile'],
    standalone: parsed.standalone === true,
    webBundle: parsed.web_bundle === true,
    variables: localVars,
    workflowPath: filePath,
    phase,
    phaseNumber,
  };
}

/**
 * Parse workflow.md file (frontmatter + content)
 */
async function parseWorkflowMd(
  filePath: string,
  config: BmadRealConfig,
  phase: string,
  phaseNumber: number
): Promise<RealWorkflowDef> {
  const content = await readFile(filePath, 'utf-8');

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};

  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  const workflowDir = dirname(filePath);
  const projectRoot = dirname(dirname(dirname(dirname(workflowDir))));

  const localVars: Record<string, string> = {
    'installed_path': workflowDir,
    'project-root': projectRoot,
    ...frontmatter,
  };

  // Resolve variables
  for (const [key, value] of Object.entries(localVars)) {
    localVars[key] = resolveVariables(value, config, localVars);
  }

  return {
    name: frontmatter.name || basename(workflowDir),
    description: frontmatter.description || '',
    configSource: join(dirname(dirname(workflowDir)), 'config.yaml'),
    installedPath: workflowDir,
    instructions: localVars['instructions'],
    template: localVars['template'],
    outputFile: localVars['default_output_file'],
    standalone: frontmatter.standalone === 'true',
    webBundle: frontmatter.web_bundle === 'true',
    variables: localVars,
    workflowPath: filePath,
    phase,
    phaseNumber,
  };
}

/**
 * Discover all workflows in _bmad folder
 */
export async function discoverWorkflows(bmadRoot: string): Promise<WorkflowDiscoveryResult> {
  const config = await loadRealConfig(bmadRoot);
  const workflowsDir = join(bmadRoot, 'bmm', 'workflows');

  const workflows: RealWorkflowDef[] = [];
  const phases = new Map<string, RealWorkflowDef[]>();

  // Phase mapping
  const phaseMap: Record<string, { name: string; number: number }> = {
    '1-analysis': { name: 'Analysis', number: 1 },
    '2-plan-workflows': { name: 'Planning', number: 2 },
    '3-solutioning': { name: 'Solutioning', number: 3 },
    '4-implementation': { name: 'Implementation', number: 4 },
    'bmad-quick-flow': { name: 'Quick Flow', number: 5 },
    'document-project': { name: 'Documentation', number: 6 },
    'excalidraw-diagrams': { name: 'Diagrams', number: 7 },
    'qa': { name: 'QA', number: 8 },
  };

  // Scan workflow directories
  const phaseDirs = await readdir(workflowsDir);

  for (const phaseDir of phaseDirs) {
    const phasePath = join(workflowsDir, phaseDir);
    const phaseStat = await stat(phasePath);

    if (!phaseStat.isDirectory()) continue;

    const phaseInfo = phaseMap[phaseDir] || { name: phaseDir, number: 99 };

    // Scan workflow folders within phase
    const workflowDirs = await readdir(phasePath);

    for (const wfDir of workflowDirs) {
      const wfPath = join(phasePath, wfDir);
      const wfStat = await stat(wfPath);

      if (!wfStat.isDirectory()) continue;

      // Look for workflow.yaml or workflow.md
      const yamlPath = join(wfPath, 'workflow.yaml');
      const mdPath = join(wfPath, 'workflow.md');

      let workflow: RealWorkflowDef | null = null;

      if (existsSync(yamlPath)) {
        workflow = await parseWorkflowYaml(yamlPath, config, phaseInfo.name, phaseInfo.number);
      } else if (existsSync(mdPath)) {
        workflow = await parseWorkflowMd(mdPath, config, phaseInfo.name, phaseInfo.number);
      }

      if (workflow) {
        workflows.push(workflow);

        // Add to phase map
        if (!phases.has(phaseInfo.name)) {
          phases.set(phaseInfo.name, []);
        }
        phases.get(phaseInfo.name)!.push(workflow);
      }
    }
  }

  // Sort workflows by phase number
  workflows.sort((a, b) => a.phaseNumber - b.phaseNumber);

  logger.info('Workflows discovered', { count: workflows.length, phases: phases.size });

  return { config, workflows, phases };
}

/**
 * Load a step file
 */
export async function loadStepFile(stepPath: string): Promise<RealStepDef | null> {
  if (!existsSync(stepPath)) {
    logger.warn('Step file not found', { stepPath });
    return null;
  }

  const content = await readFile(stepPath, 'utf-8');

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};

  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Extract content after frontmatter
  const mainContent = frontmatterMatch
    ? content.slice(frontmatterMatch[0].length).trim()
    : content;

  // Extract goal
  const goalMatch = mainContent.match(/##\s*(?:STEP\s*)?GOAL:?\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
  const goal = goalMatch ? goalMatch[1].trim() : '';

  // Parse sections
  const sections: StepSection[] = [];
  const sectionPattern = /###\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*\d+\.|\n##\s*[🚨✅❌]|$)/g;

  let match;
  while ((match = sectionPattern.exec(mainContent)) !== null) {
    const sectionContent = match[3].trim();
    sections.push({
      number: parseInt(match[1], 10),
      title: match[2].trim(),
      content: sectionContent,
      isMenu: /menu|options|choices/i.test(match[2]) || /\[a\].*\[c\].*\[p\]/i.test(sectionContent),
      isCritical: /critical|mandatory|required/i.test(sectionContent),
    });
  }

  logger.debug('Step file loaded', {
    stepPath,
    name: frontmatter.name,
    sections: sections.length,
  });

  return {
    name: frontmatter.name || basename(stepPath, '.md'),
    description: frontmatter.description || '',
    nextStepFile: frontmatter.nextStepFile,
    outputFile: frontmatter.outputFile,
    templateRef: frontmatter.productBriefTemplate || frontmatter.template,
    goal,
    content: mainContent,
    sections,
    stepPath,
  };
}

/**
 * Find steps folder for a workflow
 */
export async function findWorkflowSteps(workflow: RealWorkflowDef): Promise<string[]> {
  const stepsDir = join(workflow.installedPath, 'steps');

  if (!existsSync(stepsDir)) {
    return [];
  }

  const files = await readdir(stepsDir);
  const stepFiles = files
    .filter(f => f.match(/^step-\d+.*\.md$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/step-(\d+)/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/step-(\d+)/)?.[1] || '0', 10);
      return numA - numB;
    })
    .map(f => join(stepsDir, f));

  return stepFiles;
}

/**
 * Get first step file for a workflow
 */
export async function getFirstStep(workflow: RealWorkflowDef): Promise<string | null> {
  const steps = await findWorkflowSteps(workflow);
  return steps.length > 0 ? steps[0] : null;
}
