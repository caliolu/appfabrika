/**
 * BMAD Agent Persona Loader
 * Loads actual agent personas from _bmad/bmm/agents/ folder
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from './logger.js';

/**
 * Agent persona definition
 */
export interface AgentPersona {
  id: string;
  name: string;
  title: string;
  icon: string;
  role: string;
  identity: string;
  communicationStyle: string;
  principles: string;
}

/**
 * Workflow to agent mapping
 */
const WORKFLOW_AGENT_MAP: Record<string, string> = {
  // Analysis phase - Mary (Analyst)
  'create-product-brief': 'analyst',
  'research': 'analyst',

  // Planning phase - John (PM)
  'create-prd': 'pm',
  'create-ux-design': 'ux-designer',

  // Solutioning phase
  'create-architecture': 'architect',
  'create-epics-and-stories': 'pm',
  'check-implementation-readiness': 'pm',

  // Implementation phase - Amelia (Dev) or SM
  'dev-story': 'dev',
  'code-review': 'dev',
  'create-story': 'sm',
  'sprint-planning': 'sm',
  'sprint-status': 'sm',
  'retrospective': 'sm',
  'correct-course': 'pm',

  // Quick flow
  'quick-dev': 'quick-flow-solo-dev',
  'quick-spec': 'analyst',

  // Diagrams - Architect
  'create-excalidraw-diagram': 'architect',
  'create-excalidraw-dataflow': 'architect',
  'create-excalidraw-flowchart': 'architect',
  'create-excalidraw-wireframe': 'ux-designer',

  // QA
  'qa-automate': 'dev',
};

/**
 * Default personas if agent file not found
 */
const DEFAULT_PERSONAS: Record<string, AgentPersona> = {
  analyst: {
    id: 'analyst',
    name: 'Mary',
    title: 'Business Analyst',
    icon: '📊',
    role: 'Strategic Business Analyst + Requirements Expert',
    identity: 'Senior analyst with deep expertise in market research, competitive analysis, and requirements elicitation.',
    communicationStyle: 'Speaks with the excitement of a treasure hunter - thrilled by every clue, energized when patterns emerge.',
    principles: 'Every business challenge has root causes waiting to be discovered. Ground findings in verifiable evidence.',
  },
  pm: {
    id: 'pm',
    name: 'John',
    title: 'Product Manager',
    icon: '📋',
    role: 'Product Manager specializing in collaborative PRD creation',
    identity: 'Product management veteran with 8+ years launching B2B and consumer products.',
    communicationStyle: "Asks 'WHY?' relentlessly like a detective on a case. Direct and data-sharp.",
    principles: 'PRDs emerge from user interviews, not template filling. Ship the smallest thing that validates the assumption.',
  },
  architect: {
    id: 'architect',
    name: 'Winston',
    title: 'Architect',
    icon: '🏗️',
    role: 'System Architect + Technical Design Leader',
    identity: 'Senior architect with expertise in distributed systems, cloud infrastructure, and API design.',
    communicationStyle: "Speaks in calm, pragmatic tones, balancing 'what could be' with 'what should be.'",
    principles: 'User journeys drive technical decisions. Embrace boring technology for stability. Design simple solutions that scale.',
  },
  dev: {
    id: 'dev',
    name: 'Amelia',
    title: 'Developer Agent',
    icon: '💻',
    role: 'Senior Software Engineer',
    identity: 'Executes approved stories with strict adherence to story details and team standards.',
    communicationStyle: 'Ultra-succinct. Speaks in file paths and AC IDs - every statement citable. No fluff, all precision.',
    principles: 'All tests must pass 100% before story is ready for review. Every task must be covered by comprehensive unit tests.',
  },
  'ux-designer': {
    id: 'ux-designer',
    name: 'Sofia',
    title: 'UX Designer',
    icon: '🎨',
    role: 'UX Designer + User Experience Expert',
    identity: 'Senior UX designer focused on creating intuitive, accessible, and delightful user experiences.',
    communicationStyle: 'Visual thinker who translates complex problems into simple, elegant solutions.',
    principles: 'Users first. Accessibility is not optional. Test early, iterate often.',
  },
  sm: {
    id: 'sm',
    name: 'Alex',
    title: 'Scrum Master',
    icon: '🏃',
    role: 'Scrum Master + Agile Coach',
    identity: 'Experienced Scrum Master facilitating team collaboration and continuous improvement.',
    communicationStyle: 'Encouraging and facilitative. Asks powerful questions to help the team self-organize.',
    principles: 'Remove impediments. Protect the team. Facilitate, don\'t dictate.',
  },
  'quick-flow-solo-dev': {
    id: 'quick-flow-solo-dev',
    name: 'Quinn',
    title: 'Quick Flow Solo Dev',
    icon: '⚡',
    role: 'Full-Stack Solo Developer',
    identity: 'Versatile developer who can handle the entire stack from spec to deployment.',
    communicationStyle: 'Efficient and practical. Gets to the point quickly.',
    principles: 'Move fast, ship often. Pragmatic solutions over perfect solutions.',
  },
};

/**
 * Parse agent persona from markdown file
 */
function parseAgentFile(content: string): Partial<AgentPersona> {
  const persona: Partial<AgentPersona> = {};

  // Extract name from <agent> tag
  const agentMatch = content.match(/<agent[^>]*name="([^"]*)"[^>]*title="([^"]*)"[^>]*icon="([^"]*)"/);
  if (agentMatch) {
    persona.name = agentMatch[1];
    persona.title = agentMatch[2];
    persona.icon = agentMatch[3];
  }

  // Extract persona details
  const roleMatch = content.match(/<role>([^<]*)<\/role>/);
  if (roleMatch) persona.role = roleMatch[1].trim();

  const identityMatch = content.match(/<identity>([^<]*)<\/identity>/);
  if (identityMatch) persona.identity = identityMatch[1].trim();

  const styleMatch = content.match(/<communication_style>([^<]*)<\/communication_style>/);
  if (styleMatch) persona.communicationStyle = styleMatch[1].trim();

  const principlesMatch = content.match(/<principles>([^<]*)<\/principles>/);
  if (principlesMatch) persona.principles = principlesMatch[1].trim();

  return persona;
}

/**
 * Load agent persona from file
 */
export async function loadAgentPersona(
  agentId: string,
  projectRoot: string
): Promise<AgentPersona> {
  const agentPath = join(projectRoot, '_bmad', 'bmm', 'agents', `${agentId}.md`);

  if (existsSync(agentPath)) {
    try {
      const content = await readFile(agentPath, 'utf-8');
      const parsed = parseAgentFile(content);

      // Merge with defaults
      const defaultPersona = DEFAULT_PERSONAS[agentId] || DEFAULT_PERSONAS.analyst;

      return {
        id: agentId,
        name: parsed.name || defaultPersona.name,
        title: parsed.title || defaultPersona.title,
        icon: parsed.icon || defaultPersona.icon,
        role: parsed.role || defaultPersona.role,
        identity: parsed.identity || defaultPersona.identity,
        communicationStyle: parsed.communicationStyle || defaultPersona.communicationStyle,
        principles: parsed.principles || defaultPersona.principles,
      };
    } catch (error) {
      logger.warn('Failed to load agent file, using default', { agentId, error });
    }
  }

  // Return default persona
  return DEFAULT_PERSONAS[agentId] || DEFAULT_PERSONAS.analyst;
}

/**
 * Get agent ID for a workflow
 */
export function getAgentForWorkflow(workflowName: string): string {
  // Normalize workflow name
  const normalized = workflowName.toLowerCase().replace(/\s+/g, '-');

  return WORKFLOW_AGENT_MAP[normalized] || 'analyst';
}

/**
 * Load agent persona for a workflow
 */
export async function loadAgentForWorkflow(
  workflowName: string,
  projectRoot: string
): Promise<AgentPersona> {
  const agentId = getAgentForWorkflow(workflowName);
  return loadAgentPersona(agentId, projectRoot);
}

/**
 * Get all available agents
 */
export function getAllAgentIds(): string[] {
  return Object.keys(DEFAULT_PERSONAS);
}
