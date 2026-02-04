/**
 * BMAD Dynamic Agent Loader
 * Load agent personas from _bmad/bmm/agents/*.md files
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentPersona } from './types.js';

export interface LoadedAgent extends AgentPersona {
  activationSteps: string[];
  menuItems: AgentMenuItem[];
  rules: string[];
  rawContent: string;
}

export interface AgentMenuItem {
  cmd: string;
  label: string;
  exec?: string;
  workflow?: string;
  data?: string;
}

/**
 * Load all agents from BMAD directory
 */
export async function loadAgentsFromBmad(bmadRoot: string): Promise<LoadedAgent[]> {
  const agentsDir = join(bmadRoot, 'bmm', 'agents');

  if (!existsSync(agentsDir)) {
    console.warn('BMAD agents directory not found:', agentsDir);
    return [];
  }

  const files = await readdir(agentsDir);
  const agentFiles = files.filter(f => f.endsWith('.md'));

  const agents: LoadedAgent[] = [];

  for (const file of agentFiles) {
    const agentPath = join(agentsDir, file);
    const agent = await loadAgentFromFile(agentPath);
    if (agent) {
      agents.push(agent);
    }
  }

  return agents;
}

/**
 * Load a single agent from file
 */
export async function loadAgentFromFile(filePath: string): Promise<LoadedAgent | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return parseAgentFile(content, filePath);
  } catch (error) {
    console.warn(`Failed to load agent from ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse agent markdown/XML content
 */
function parseAgentFile(content: string, filePath: string): LoadedAgent | null {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};

  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        frontmatter[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  // Extract agent XML block
  const agentMatch = content.match(/<agent[^>]*>([\s\S]*?)<\/agent>/);
  if (!agentMatch) {
    return null;
  }

  const agentXml = agentMatch[0];

  // Parse agent attributes
  const idMatch = agentXml.match(/id="([^"]+)"/);
  const nameMatch = agentXml.match(/name="([^"]+)"/);
  const titleMatch = agentXml.match(/title="([^"]+)"/);
  const iconMatch = agentXml.match(/icon="([^"]+)"/);

  // Parse persona
  const roleMatch = agentXml.match(/<role>([^<]+)<\/role>/);
  const identityMatch = agentXml.match(/<identity>([^<]+)<\/identity>/);
  const styleMatch = agentXml.match(/<communication_style>([^<]+)<\/communication_style>/);
  const principlesMatch = agentXml.match(/<principles>([^<]+)<\/principles>/);

  // Parse activation steps
  const activationSteps: string[] = [];
  const stepMatches = agentXml.matchAll(/<step n="(\d+)"[^>]*>([^<]+)<\/step>/g);
  for (const match of stepMatches) {
    activationSteps.push(match[2].trim());
  }

  // Parse menu items
  const menuItems: AgentMenuItem[] = [];
  const menuMatches = agentXml.matchAll(/<item[^>]*cmd="([^"]+)"[^>]*(?:exec="([^"]+)")?[^>]*(?:workflow="([^"]+)")?[^>]*(?:data="([^"]+)")?[^>]*>([^<]+)<\/item>/g);
  for (const match of menuMatches) {
    menuItems.push({
      cmd: match[1],
      label: match[5].trim(),
      exec: match[2] || undefined,
      workflow: match[3] || undefined,
      data: match[4] || undefined,
    });
  }

  // Parse rules
  const rules: string[] = [];
  const ruleMatches = agentXml.matchAll(/<r>([^<]+)<\/r>/g);
  for (const match of ruleMatches) {
    rules.push(match[1].trim());
  }

  // Map to standard ID
  const agentId = frontmatter.name || idMatch?.[1] || 'unknown';
  const agentIdMap: Record<string, string> = {
    analyst: 'analyst',
    pm: 'pm',
    'ux-designer': 'ux-designer',
    architect: 'architect',
    sm: 'sm',
    dev: 'dev',
    quinn: 'quinn',
    'tech-writer': 'tech-writer',
  };

  return {
    id: agentIdMap[agentId] || agentId,
    name: nameMatch?.[1] || frontmatter.name || 'Unknown',
    title: titleMatch?.[1] || frontmatter.description || 'Agent',
    emoji: iconMatch?.[1] || '🤖',
    role: roleMatch?.[1] || 'Agent',
    expertise: extractExpertise(identityMatch?.[1] || ''),
    perspective: principlesMatch?.[1] || '',
    communicationStyle: styleMatch?.[1] || '',
    criticalQuestions: extractQuestions(content),
    activationSteps,
    menuItems,
    rules,
    rawContent: content,
  };
}

/**
 * Extract expertise areas from identity
 */
function extractExpertise(identity: string): string[] {
  const expertise: string[] = [];

  // Common expertise keywords
  const keywords = [
    'market research', 'competitive analysis', 'requirements',
    'product strategy', 'roadmap', 'stakeholder',
    'user research', 'interaction design', 'usability', 'accessibility',
    'system design', 'scalability', 'security', 'performance',
    'agile', 'sprint', 'scrum',
    'clean code', 'testing', 'debugging',
    'test strategy', 'automation', 'quality',
  ];

  const identityLower = identity.toLowerCase();
  for (const keyword of keywords) {
    if (identityLower.includes(keyword)) {
      expertise.push(keyword);
    }
  }

  return expertise.length > 0 ? expertise : ['general'];
}

/**
 * Extract critical questions from content
 */
function extractQuestions(content: string): string[] {
  const questions: string[] = [];

  // Look for question patterns
  const questionMatches = content.match(/\?[^?]*$/gm);
  if (questionMatches) {
    for (const match of questionMatches.slice(0, 5)) {
      const cleaned = match.replace(/^[^a-zA-ZÀ-ÿ]+/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        questions.push(cleaned);
      }
    }
  }

  return questions;
}

/**
 * Get agent greeting based on loaded agent
 */
export function getAgentGreeting(agent: LoadedAgent, userName: string): string {
  return `Merhaba ${userName}! Ben ${agent.name}, ${agent.title}. ${agent.role} olarak size yardımcı olmak için buradayım.

${agent.communicationStyle}

Nasıl yardımcı olabilirim?`;
}

/**
 * Get agent menu as formatted string
 */
export function formatAgentMenu(agent: LoadedAgent): string {
  let menu = `\n📋 ${agent.name} Menüsü:\n\n`;

  agent.menuItems.forEach((item, index) => {
    menu += `  ${index + 1}. ${item.label}\n`;
  });

  return menu;
}

/**
 * Execute agent menu item
 */
export async function executeMenuItem(
  agent: LoadedAgent,
  itemIndex: number,
  bmadRoot: string
): Promise<{ type: 'exec' | 'workflow' | 'chat' | 'dismiss'; path?: string }> {
  const item = agent.menuItems[itemIndex];

  if (!item) {
    return { type: 'chat' };
  }

  if (item.exec) {
    const path = item.exec.replace('{project-root}/_bmad', bmadRoot);
    return { type: 'exec', path };
  }

  if (item.workflow) {
    const path = item.workflow.replace('{project-root}/_bmad', bmadRoot);
    return { type: 'workflow', path };
  }

  if (item.cmd.includes('dismiss') || item.cmd.includes('exit')) {
    return { type: 'dismiss' };
  }

  return { type: 'chat' };
}

/**
 * Convert loaded agents to standard AgentPersona format
 */
export function toAgentPersonas(loadedAgents: LoadedAgent[]): AgentPersona[] {
  return loadedAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    title: agent.title,
    emoji: agent.emoji,
    role: agent.role,
    expertise: agent.expertise,
    perspective: agent.perspective,
    communicationStyle: agent.communicationStyle,
    criticalQuestions: agent.criticalQuestions,
  }));
}
