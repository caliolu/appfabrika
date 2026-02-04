/**
 * BMAD Template Engine
 * Template loading, placeholder resolution, and A/P/C/Y menu system
 */

import * as p from '@clack/prompts';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import type { ExecutionContext } from './types.js';

// ============================================================================
// TEMPLATE SYSTEM
// ============================================================================

export interface TemplateVariable {
  name: string;
  value: string;
  source: 'config' | 'user' | 'system' | 'context';
}

export interface LoadedTemplate {
  path: string;
  content: string;
  variables: string[];
  sections: TemplateSection[];
}

export interface TemplateSection {
  name: string;
  placeholder: string;
  content: string;
  completed: boolean;
}

/**
 * Load a template file from BMAD
 */
export async function loadTemplate(
  templatePath: string,
  bmadRoot: string
): Promise<LoadedTemplate | null> {
  // Resolve path
  const fullPath = templatePath.startsWith('/')
    ? templatePath
    : templatePath.replace('{project-root}/_bmad', bmadRoot).replace('{project-root}', bmadRoot.replace('/_bmad', ''));

  if (!existsSync(fullPath)) {
    return null;
  }

  const content = await readFile(fullPath, 'utf-8');

  // Extract variables ({{variable_name}})
  const variableMatches = content.match(/\{\{([^}]+)\}\}/g) || [];
  const variables = [...new Set(variableMatches.map(m => m.replace(/\{\{|\}\}/g, '')))];

  // Extract sections (## Section Name or ### Section Name)
  const sections: TemplateSection[] = [];
  const sectionRegex = /^(#{2,3})\s+(.+)$/gm;
  let match;

  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push({
      name: match[2].trim(),
      placeholder: match[0],
      content: '',
      completed: false,
    });
  }

  return {
    path: fullPath,
    content,
    variables,
    sections,
  };
}

/**
 * Resolve template variables
 */
export function resolveVariables(
  content: string,
  variables: Map<string, string>
): string {
  let resolved = content;

  for (const [name, value] of variables) {
    const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
    resolved = resolved.replace(regex, value);
  }

  // System variables
  resolved = resolved.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
  resolved = resolved.replace(/\{\{timestamp\}\}/g, new Date().toISOString());

  return resolved;
}

/**
 * Get default variables from config and context
 */
export function getDefaultVariables(
  context: ExecutionContext,
  config?: Record<string, string>
): Map<string, string> {
  const variables = new Map<string, string>();

  // From context
  variables.set('project_name', context.projectName);
  variables.set('project_path', context.projectPath);
  variables.set('idea', context.idea);

  // From config
  if (config) {
    for (const [key, value] of Object.entries(config)) {
      variables.set(key, value);
    }
  }

  // System defaults
  variables.set('date', new Date().toISOString().split('T')[0]);
  variables.set('user_name', process.env.USER || 'User');
  variables.set('communication_language', 'Turkish');

  return variables;
}

// ============================================================================
// A/P/C/Y MENU SYSTEM
// ============================================================================

export type MenuChoice = 'advanced' | 'party' | 'continue' | 'yolo' | 'edit';

export interface MenuResult {
  choice: MenuChoice;
  yoloEnabled: boolean;
  enhancedContent?: string;
}

/**
 * Show A/P/C/Y menu after each step
 */
export async function showStepMenu(
  currentContent: string,
  stepName: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  yoloMode: boolean = false
): Promise<MenuResult> {
  // If YOLO mode is enabled, auto-continue
  if (yoloMode) {
    return { choice: 'continue', yoloEnabled: true };
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`📝 "${stepName}" bölümü tamamlandı.`);
  console.log('─'.repeat(60));

  const choice = await p.select({
    message: 'Sonraki adım?',
    options: [
      {
        value: 'continue',
        label: '[C] Devam Et',
        hint: 'Bir sonraki adıma geç',
      },
      {
        value: 'advanced',
        label: '[A] Advanced Elicitation',
        hint: 'Derinlemesine sorgulama teknikleri',
      },
      {
        value: 'party',
        label: '[P] Party Mode',
        hint: 'Tüm uzmanlarla tartışma',
      },
      {
        value: 'yolo',
        label: '[Y] YOLO Mode',
        hint: 'Kalan adımları otomatik tamamla',
      },
      {
        value: 'edit',
        label: '[E] Düzenle',
        hint: 'Bu bölümü düzenle',
      },
    ],
  });

  if (p.isCancel(choice)) {
    return { choice: 'continue', yoloEnabled: false };
  }

  const selectedChoice = choice as MenuChoice;

  // Handle Advanced Elicitation
  if (selectedChoice === 'advanced') {
    const enhanced = await runAdvancedElicitation(currentContent, stepName, context, adapter);
    return { choice: 'advanced', yoloEnabled: false, enhancedContent: enhanced };
  }

  // Handle Party Mode
  if (selectedChoice === 'party') {
    const { runPartyMode } = await import('./features.js');
    const result = await runPartyMode(
      {
        topic: `"${stepName}" bölümünü değerlendirelim:\n\n${currentContent.slice(0, 2000)}`,
        context,
        rounds: 1,
      },
      adapter,
      true
    );
    return {
      choice: 'party',
      yoloEnabled: false,
      enhancedContent: currentContent + '\n\n---\n\n## Uzman Tartışması\n\n' + result.discussion,
    };
  }

  // Handle YOLO mode
  if (selectedChoice === 'yolo') {
    p.log.info('🚀 YOLO modu aktif! Kalan adımlar otomatik tamamlanacak.');
    return { choice: 'yolo', yoloEnabled: true };
  }

  // Handle Edit
  if (selectedChoice === 'edit') {
    const editPrompt = await p.text({
      message: 'Nasıl düzenlenmeli?',
      placeholder: 'Düzenleme talimatlarını yazın...',
    });

    if (!p.isCancel(editPrompt)) {
      const editedContent = await applyEdit(currentContent, editPrompt as string, adapter);
      return { choice: 'edit', yoloEnabled: false, enhancedContent: editedContent };
    }
  }

  return { choice: 'continue', yoloEnabled: false };
}

/**
 * Apply edit to content
 */
async function applyEdit(
  content: string,
  instruction: string,
  adapter: AnthropicAdapter
): Promise<string> {
  const prompt = `Aşağıdaki içeriği düzenle:

${content}

---

Düzenleme talimatı: ${instruction}

Düzenlenmiş içeriği döndür. Sadece içeriği ver, açıklama ekleme.`;

  let result = '';
  const stream = adapter.stream(prompt, {
    maxTokens: 4096,
    systemPrompt: 'Sen bir editörsün. Verilen talimatla içeriği düzenle.',
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk);
    result += chunk;
  }
  console.log('');

  return result;
}

// ============================================================================
// ADVANCED ELICITATION (50+ Methods)
// ============================================================================

export interface ElicitationMethod {
  num: number;
  category: string;
  method_name: string;
  description: string;
  output_pattern: string;
}

// Built-in elicitation methods (from BMAD methods.csv)
const ELICITATION_METHODS: ElicitationMethod[] = [
  // Collaboration
  { num: 1, category: 'collaboration', method_name: 'Stakeholder Round Table', description: 'Convene multiple personas to contribute diverse perspectives - essential for requirements gathering', output_pattern: 'perspectives → synthesis → alignment' },
  { num: 2, category: 'collaboration', method_name: 'Expert Panel Review', description: 'Assemble domain experts for deep specialized analysis', output_pattern: 'expert views → consensus → recommendations' },
  { num: 3, category: 'collaboration', method_name: 'Debate Club Showdown', description: 'Two personas argue opposing positions while a moderator scores points', output_pattern: 'thesis → antithesis → synthesis' },
  { num: 4, category: 'collaboration', method_name: 'User Persona Focus Group', description: 'Gather your products user personas to react to proposals', output_pattern: 'reactions → concerns → priorities' },
  { num: 5, category: 'collaboration', method_name: 'Cross-Functional War Room', description: 'Product manager + engineer + designer tackle a problem together', output_pattern: 'constraints → trade-offs → balanced solution' },

  // Advanced
  { num: 11, category: 'advanced', method_name: 'Tree of Thoughts', description: 'Explore multiple reasoning paths simultaneously then evaluate and select the best', output_pattern: 'paths → evaluation → selection' },
  { num: 12, category: 'advanced', method_name: 'Graph of Thoughts', description: 'Model reasoning as an interconnected network of ideas', output_pattern: 'nodes → connections → patterns' },
  { num: 13, category: 'advanced', method_name: 'Self-Consistency Validation', description: 'Generate multiple independent approaches then compare for consistency', output_pattern: 'approaches → comparison → consensus' },
  { num: 14, category: 'advanced', method_name: 'Meta-Prompting Analysis', description: 'Step back to analyze the approach structure itself', output_pattern: 'current → analysis → optimization' },
  { num: 15, category: 'advanced', method_name: 'Reasoning via Planning', description: 'Build a reasoning tree guided by world models and goal states', output_pattern: 'model → planning → strategy' },

  // Competitive
  { num: 17, category: 'competitive', method_name: 'Red Team vs Blue Team', description: 'Adversarial attack-defend analysis to find vulnerabilities', output_pattern: 'defense → attack → hardening' },
  { num: 18, category: 'competitive', method_name: 'Shark Tank Pitch', description: 'Entrepreneur pitches to skeptical investors who poke holes', output_pattern: 'pitch → challenges → refinement' },
  { num: 19, category: 'competitive', method_name: 'Code Review Gauntlet', description: 'Senior devs with different philosophies review the same code', output_pattern: 'reviews → debates → standards' },

  // Technical
  { num: 20, category: 'technical', method_name: 'Architecture Decision Records', description: 'Multiple architect personas propose and debate architectural choices', output_pattern: 'options → trade-offs → decision → rationale' },
  { num: 21, category: 'technical', method_name: 'Rubber Duck Debugging Evolved', description: 'Explain your code to progressively more technical ducks', output_pattern: 'simple → detailed → technical → aha' },
  { num: 22, category: 'technical', method_name: 'Security Audit Personas', description: 'Hacker + defender + auditor examine system from different angles', output_pattern: 'vulnerabilities → defenses → compliance' },
  { num: 23, category: 'technical', method_name: 'Performance Profiler Panel', description: 'Database expert + frontend specialist + DevOps engineer diagnose slowness', output_pattern: 'symptoms → analysis → optimizations' },

  // Creative
  { num: 25, category: 'creative', method_name: 'SCAMPER Method', description: 'Apply seven creativity lenses (Substitute/Combine/Adapt/Modify/Put/Eliminate/Reverse)', output_pattern: 'S→C→A→M→P→E→R' },
  { num: 26, category: 'creative', method_name: 'Reverse Engineering', description: 'Work backwards from desired outcome to find implementation path', output_pattern: 'end state → steps backward → path forward' },
  { num: 27, category: 'creative', method_name: 'What If Scenarios', description: 'Explore alternative realities to understand possibilities', output_pattern: 'scenarios → implications → insights' },
  { num: 28, category: 'creative', method_name: 'Random Input Stimulus', description: 'Inject unrelated concepts to spark unexpected connections', output_pattern: 'random word → associations → novel ideas' },
  { num: 29, category: 'creative', method_name: 'Genre Mashup', description: 'Combine two unrelated domains to find fresh approaches', output_pattern: 'domain A + domain B → hybrid insights' },

  // Risk
  { num: 34, category: 'risk', method_name: 'Pre-mortem Analysis', description: 'Imagine future failure then work backwards to prevent it', output_pattern: 'failure scenario → causes → prevention' },
  { num: 35, category: 'risk', method_name: 'Failure Mode Analysis', description: 'Systematically explore how each component could fail', output_pattern: 'components → failures → prevention' },
  { num: 36, category: 'risk', method_name: 'Devils Advocate', description: 'Play devils advocate to stress-test ideas and find weaknesses', output_pattern: 'assumptions → challenges → strengthening' },
  { num: 37, category: 'risk', method_name: 'Chaos Monkey Scenarios', description: 'Deliberately break things to test resilience', output_pattern: 'break → observe → harden' },

  // Core
  { num: 39, category: 'core', method_name: 'First Principles Analysis', description: 'Strip away assumptions to rebuild from fundamental truths', output_pattern: 'assumptions → truths → new approach' },
  { num: 40, category: 'core', method_name: '5 Whys Deep Dive', description: 'Repeatedly ask why to drill down to root causes', output_pattern: 'why chain → root cause → solution' },
  { num: 41, category: 'core', method_name: 'Socratic Questioning', description: 'Use targeted questions to reveal hidden assumptions', output_pattern: 'questions → revelations → understanding' },
  { num: 42, category: 'core', method_name: 'Critique and Refine', description: 'Systematic review to identify strengths and weaknesses', output_pattern: 'strengths/weaknesses → improvements → refined' },

  // Research
  { num: 31, category: 'research', method_name: 'Literature Review Personas', description: 'Optimist researcher + skeptic researcher + synthesizer review sources', output_pattern: 'sources → critiques → synthesis' },
  { num: 32, category: 'research', method_name: 'Thesis Defense Simulation', description: 'Student defends hypothesis against committee', output_pattern: 'thesis → challenges → defense → refinements' },
  { num: 33, category: 'research', method_name: 'Comparative Analysis Matrix', description: 'Multiple analysts evaluate options against weighted criteria', output_pattern: 'options → criteria → scores → recommendation' },

  // Learning
  { num: 45, category: 'learning', method_name: 'Feynman Technique', description: 'Explain complex concepts simply as if teaching a child', output_pattern: 'complex → simple → gaps → mastery' },
  { num: 46, category: 'learning', method_name: 'Active Recall Testing', description: 'Test understanding without references to verify true knowledge', output_pattern: 'test → gaps → reinforcement' },

  // Philosophical
  { num: 47, category: 'philosophical', method_name: 'Occams Razor', description: 'Find the simplest sufficient explanation', output_pattern: 'options → simplification → selection' },
  { num: 48, category: 'philosophical', method_name: 'Trolley Problem Variations', description: 'Explore ethical trade-offs through moral dilemmas', output_pattern: 'dilemma → analysis → decision' },

  // Retrospective
  { num: 49, category: 'retrospective', method_name: 'Hindsight Reflection', description: 'Imagine looking back from the future to gain perspective', output_pattern: 'future view → insights → application' },
  { num: 50, category: 'retrospective', method_name: 'Lessons Learned Analysis', description: 'Extract actionable insights from past experiences', output_pattern: 'experience → lessons → improvements' },
];

/**
 * Run Advanced Elicitation workflow
 */
export async function runAdvancedElicitation(
  content: string,
  sectionName: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter
): Promise<string> {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║ 🔬 ADVANCED ELICITATION'.padEnd(59) + '║');
  console.log('║ ' + 'Derinlemesine sorgulama teknikleri'.padEnd(57) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  let enhancedContent = content;
  let continueElicitation = true;

  while (continueElicitation) {
    // Select 5 random methods with diversity
    const selectedMethods = selectDiverseMethods(5);

    console.log('\n**Advanced Elicitation Seçenekleri**\n');
    console.log('Bir numara seçin (1-5), [R] Yenile, [A] Tümünü Listele, [X] Çıkış:\n');

    selectedMethods.forEach((method, index) => {
      console.log(`  ${index + 1}. [${method.category.toUpperCase()}] ${method.method_name}`);
      console.log(`     ${method.description.slice(0, 60)}...`);
    });
    console.log('  R. Listeyi yenile (5 yeni seçenek)');
    console.log('  A. Tüm metodları listele');
    console.log('  X. Çıkış / Devam et');

    const choice = await p.text({
      message: 'Seçiminiz:',
      placeholder: '1-5, R, A, veya X',
    });

    if (p.isCancel(choice) || (choice as string).toUpperCase() === 'X') {
      continueElicitation = false;
      break;
    }

    const input = (choice as string).toUpperCase();

    // Handle number selection
    const num = parseInt(input);
    if (num >= 1 && num <= 5) {
      const method = selectedMethods[num - 1];
      console.log(`\n🔄 "${method.method_name}" uygulanıyor...\n`);

      enhancedContent = await applyElicitationMethod(
        enhancedContent,
        method,
        sectionName,
        context,
        adapter
      );

      // Ask if user wants to keep the changes
      const keepChanges = await p.confirm({
        message: 'Bu değişiklikleri uygulayalım mı?',
        initialValue: true,
      });

      if (p.isCancel(keepChanges) || !keepChanges) {
        enhancedContent = content; // Revert
        p.log.info('Değişiklikler geri alındı.');
      } else {
        p.log.success('Değişiklikler uygulandı.');
      }

      continue;
    }

    // Handle Reshuffle
    if (input === 'R') {
      p.log.info('Liste yenileniyor...');
      continue;
    }

    // Handle List All
    if (input === 'A') {
      console.log('\n📋 Tüm Elicitation Metodları:\n');

      const categories = [...new Set(ELICITATION_METHODS.map(m => m.category))];
      for (const category of categories) {
        console.log(`\n### ${category.toUpperCase()}`);
        const methods = ELICITATION_METHODS.filter(m => m.category === category);
        methods.forEach(m => {
          console.log(`  ${m.num}. ${m.method_name}: ${m.description.slice(0, 50)}...`);
        });
      }

      continue;
    }

    p.log.warn('Geçersiz seçim. Tekrar deneyin.');
  }

  return enhancedContent;
}

/**
 * Select diverse methods from different categories
 */
function selectDiverseMethods(count: number): ElicitationMethod[] {
  const categories = [...new Set(ELICITATION_METHODS.map(m => m.category))];
  const selected: ElicitationMethod[] = [];
  const usedCategories = new Set<string>();

  // First, get one from each category until we have enough
  while (selected.length < count && usedCategories.size < categories.length) {
    const availableCategories = categories.filter(c => !usedCategories.has(c));
    const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    const categoryMethods = ELICITATION_METHODS.filter(m => m.category === randomCategory);
    const randomMethod = categoryMethods[Math.floor(Math.random() * categoryMethods.length)];

    if (!selected.find(m => m.num === randomMethod.num)) {
      selected.push(randomMethod);
      usedCategories.add(randomCategory);
    }
  }

  // Fill remaining with random methods
  while (selected.length < count) {
    const randomMethod = ELICITATION_METHODS[Math.floor(Math.random() * ELICITATION_METHODS.length)];
    if (!selected.find(m => m.num === randomMethod.num)) {
      selected.push(randomMethod);
    }
  }

  return selected;
}

/**
 * Apply an elicitation method to content
 */
async function applyElicitationMethod(
  content: string,
  method: ElicitationMethod,
  sectionName: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter
): Promise<string> {
  const systemPrompt = `Sen bir ${method.method_name} uzmanısın.
Bu tekniği kullanarak verilen içeriği analiz edecek ve zenginleştireceksin.

Teknik Açıklaması: ${method.description}
Çıktı Paterni: ${method.output_pattern}

İçeriği bu teknikle işle ve zenginleştirilmiş versiyonunu döndür.`;

  const prompt = `Bölüm: ${sectionName}
Proje: ${context.idea}

---

Mevcut İçerik:
${content}

---

"${method.method_name}" tekniğini uygula:
1. ${method.output_pattern.split('→').join('\n2. ')}

Zenginleştirilmiş içeriği oluştur. Orijinal yapıyı koru ama derinlik kat.`;

  let result = '';
  const stream = adapter.stream(prompt, {
    maxTokens: 4096,
    systemPrompt,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk);
    result += chunk;
  }
  console.log('');

  return result;
}

// ============================================================================
// YOLO MODE
// ============================================================================

export interface YoloState {
  enabled: boolean;
  startedAt?: Date;
  stepsCompleted: number;
}

/**
 * Create initial YOLO state
 */
export function createYoloState(): YoloState {
  return {
    enabled: false,
    stepsCompleted: 0,
  };
}

/**
 * Enable YOLO mode
 */
export function enableYoloMode(state: YoloState): YoloState {
  return {
    ...state,
    enabled: true,
    startedAt: new Date(),
  };
}

/**
 * Check if should auto-continue in YOLO mode
 */
export function shouldAutoContinue(state: YoloState): boolean {
  return state.enabled;
}
