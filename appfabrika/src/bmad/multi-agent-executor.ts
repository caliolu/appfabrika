/**
 * Multi-Agent BMAD Executor
 *
 * Implements FULL BMAD methodology with two AI agents:
 * - Facilitator Agent: Follows BMAD step instructions exactly
 * - User Agent: Acts as domain expert, answers questions
 *
 * This enables automatic BMAD execution while maintaining
 * the collaborative conversation flow that BMAD requires.
 */

import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as p from '@clack/prompts';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import {
  type RealWorkflowDef,
  type RealStepDef,
  loadStepFile,
  findWorkflowSteps,
  type BmadRealConfig,
} from './real-workflow-loader.js';
import { documentManager } from './document-manager.js';
import { createInputDiscovery, type DiscoveryResult } from './input-discovery.js';
import { logger } from './logger.js';
import { tokenTracker } from './token-tracker.js';

/**
 * BMAD XML Tag types
 */
type BmadTagType =
  | 'step'
  | 'substep'
  | 'action'
  | 'check'
  | 'ask'
  | 'output'
  | 'goto'
  | 'anchor'
  | 'critical'
  | 'template-output'
  | 'invoke-workflow'
  | 'invoke-task'
  | 'invoke-protocol'
  | 'iterate';

/**
 * Parsed BMAD XML tag
 */
interface BmadTag {
  type: BmadTagType;
  content: string;
  attributes: Record<string, string>;
  children?: BmadTag[];
}

/**
 * Parsed instruction from step file
 */
interface ParsedInstruction {
  number: number;
  title: string;
  goal?: string;
  type: 'conversation' | 'questions' | 'content-generation' | 'menu' | 'xml-workflow';
  content: string;
  questions: string[];
  isMenu: boolean;
  tags: BmadTag[];
  menuOptions?: {
    advanced?: string;
    party?: string;
    continue?: string;
  };
}

/**
 * Conversation turn
 */
interface ConversationTurn {
  role: 'facilitator' | 'user';
  content: string;
  timestamp: string;
}

/**
 * Multi-agent execution state
 */
interface MultiAgentState {
  workflow: RealWorkflowDef;
  config: BmadRealConfig;
  projectRoot: string;
  projectIdea: string;
  conversationHistory: ConversationTurn[];
  generatedContent: Map<string, string>;
  currentStepIndex: number;
  stepFiles: string[];
  inputDocuments: DiscoveryResult | null;
  outputPath?: string;
}

/**
 * Parse step file into executable instructions
 */
function parseStepInstructions(step: RealStepDef): ParsedInstruction[] {
  const instructions: ParsedInstruction[] = [];
  const content = step.content;

  // Check if this is an XML workflow format
  if (isXmlWorkflow(content)) {
    return parseXmlWorkflowInstructions(content);
  }

  // Find "Sequence of Instructions" section
  const sequenceMatch = content.match(/##\s*Sequence of Instructions[^\n]*\n([\s\S]*?)(?=\n##\s*(?:CRITICAL|🚨)|$)/i);
  if (!sequenceMatch) {
    // Fallback: parse all ### sections
    const sectionPattern = /###\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*\d+\.|$)/g;
    let match;
    while ((match = sectionPattern.exec(content)) !== null) {
      const sectionContent = match[3].trim();
      const questions = extractQuestions(sectionContent);
      const isMenu = /menu|options|\[A\]|\[P\]|\[C\]/i.test(match[2]) ||
                     /\[A\].*\[P\].*\[C\]/i.test(sectionContent);
      const tags = parseBmadTags(sectionContent);

      instructions.push({
        number: parseInt(match[1], 10),
        title: match[2].trim(),
        type: isMenu ? 'menu' : questions.length > 0 ? 'questions' : 'conversation',
        content: sectionContent,
        questions,
        isMenu,
        tags,
        menuOptions: isMenu ? parseMenuOptions(sectionContent) : undefined,
      });
    }
    return instructions;
  }

  const sequenceContent = sequenceMatch[1];
  const sectionPattern = /###\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*\d+\.|$)/g;

  let match;
  while ((match = sectionPattern.exec(sequenceContent)) !== null) {
    const sectionContent = match[3].trim();
    const questions = extractQuestions(sectionContent);
    const isMenu = /menu|options|\[A\]|\[P\]|\[C\]/i.test(match[2]) ||
                   /\[A\].*\[P\].*\[C\]/i.test(sectionContent) ||
                   /Select an Option/i.test(sectionContent);
    const tags = parseBmadTags(sectionContent);

    let type: ParsedInstruction['type'] = 'conversation';
    if (isMenu) {
      type = 'menu';
    } else if (questions.length > 0) {
      type = 'questions';
    } else if (/content|generate|append|markdown/i.test(sectionContent)) {
      type = 'content-generation';
    }

    instructions.push({
      number: parseInt(match[1], 10),
      title: match[2].trim(),
      type,
      content: sectionContent,
      questions,
      isMenu,
      tags,
      menuOptions: isMenu ? parseMenuOptions(sectionContent) : undefined,
    });
  }

  return instructions;
}

/**
 * Parse XML workflow format instructions
 */
function parseXmlWorkflowInstructions(content: string): ParsedInstruction[] {
  const instructions: ParsedInstruction[] = [];

  // Parse <step> tags
  const stepPattern = /<step\s+n=["'](\d+)["'](?:\s+goal=["']([^"']*)["'])?(?:\s+[^>]*)?>[\s\S]*?<\/step>/gi;

  let match;
  let stepNum = 0;
  while ((match = stepPattern.exec(content)) !== null) {
    stepNum++;
    const fullStepContent = match[0];
    const stepNumber = parseInt(match[1], 10);
    const goal = match[2] || '';

    // Extract step title from goal or first action
    const title = goal || `Step ${stepNumber}`;

    // Parse tags within this step
    const tags = parseBmadTags(fullStepContent);

    // Check for ask tags (questions)
    const askTags = tags.filter(t => t.type === 'ask');
    const questions = askTags.map(t => t.content);

    // Check for template-output (menu)
    const hasTemplateOutput = tags.some(t => t.type === 'template-output');

    instructions.push({
      number: stepNumber,
      title,
      goal,
      type: 'xml-workflow',
      content: fullStepContent,
      questions,
      isMenu: hasTemplateOutput,
      tags,
      menuOptions: hasTemplateOutput ? {
        advanced: 'Start advanced elicitation',
        party: 'Start party mode',
        continue: 'Continue to next step',
      } : undefined,
    });
  }

  // If no steps found, treat entire content as single instruction
  if (instructions.length === 0) {
    const tags = parseBmadTags(content);
    instructions.push({
      number: 1,
      title: 'Workflow Execution',
      type: 'xml-workflow',
      content,
      questions: [],
      isMenu: false,
      tags,
    });
  }

  return instructions;
}

/**
 * Extract questions from content
 */
function extractQuestions(content: string): string[] {
  const questions: string[] = [];

  // Pattern 1: Lines starting with - that end with ?
  const bulletQuestions = content.match(/^[-•]\s*([^\n]+\?)/gm);
  if (bulletQuestions) {
    questions.push(...bulletQuestions.map(q => q.replace(/^[-•]\s*/, '').trim()));
  }

  // Pattern 2: Lines ending with ?
  const lineQuestions = content.match(/^[A-Z][^\n]+\?$/gm);
  if (lineQuestions) {
    questions.push(...lineQuestions.filter(q => !questions.includes(q)));
  }

  return questions;
}

/**
 * Parse menu options from content
 */
function parseMenuOptions(content: string): ParsedInstruction['menuOptions'] {
  const options: ParsedInstruction['menuOptions'] = {};

  // Look for IF A:, IF P:, IF C: patterns
  const advancedMatch = content.match(/IF\s*A[:\s]+(.*?)(?=IF\s*[PC]|$)/is);
  const partyMatch = content.match(/IF\s*P[:\s]+(.*?)(?=IF\s*[AC]|$)/is);
  const continueMatch = content.match(/IF\s*C[:\s]+(.*?)(?=IF\s*[AP]|$)/is);

  if (advancedMatch) options.advanced = advancedMatch[1].trim();
  if (partyMatch) options.party = partyMatch[1].trim();
  if (continueMatch) options.continue = continueMatch[1].trim();

  return options;
}

/**
 * Parse BMAD XML tags from content
 */
function parseBmadTags(content: string): BmadTag[] {
  const tags: BmadTag[] = [];

  // Tag patterns to look for
  const tagPatterns: { type: BmadTagType; regex: RegExp }[] = [
    { type: 'step', regex: /<step\s+([^>]*)>([\s\S]*?)<\/step>/gi },
    { type: 'substep', regex: /<substep\s+([^>]*)>([\s\S]*?)<\/substep>/gi },
    { type: 'action', regex: /<action(?:\s+([^>]*))?>([^<]*(?:<(?!\/action>)[^<]*)*)<\/action>/gi },
    { type: 'action', regex: /<action\s+([^>]*)\/>/gi }, // Self-closing action
    { type: 'check', regex: /<check\s+([^>]*)>([\s\S]*?)<\/check>/gi },
    { type: 'ask', regex: /<ask(?:\s+([^>]*))?>([\s\S]*?)<\/ask>/gi },
    { type: 'output', regex: /<output(?:\s+([^>]*))?>([\s\S]*?)<\/output>/gi },
    { type: 'goto', regex: /<goto\s+([^>]*)\/?\s*>/gi },
    { type: 'anchor', regex: /<anchor\s+([^>]*)\/?\s*>/gi },
    { type: 'critical', regex: /<critical(?:\s+([^>]*))?>([\s\S]*?)<\/critical>/gi },
    { type: 'template-output', regex: /<template-output(?:\s+([^>]*))?>([\s\S]*?)<\/template-output>/gi },
    { type: 'invoke-workflow', regex: /<invoke-workflow\s+([^>]*)\/?\s*>/gi },
    { type: 'invoke-task', regex: /<invoke-task\s+([^>]*)\/?\s*>/gi },
    { type: 'invoke-protocol', regex: /<invoke-protocol\s+([^>]*)\/?\s*>/gi },
    { type: 'iterate', regex: /<iterate(?:\s+([^>]*))?>([\s\S]*?)<\/iterate>/gi },
  ];

  for (const { type, regex } of tagPatterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const attributes = parseAttributes(match[1] || '');
      const tagContent = match[2] || '';

      tags.push({
        type,
        content: tagContent.trim(),
        attributes,
        children: tagContent ? parseBmadTags(tagContent) : undefined,
      });
    }
  }

  // Sort by position in original content
  return tags;
}

/**
 * Parse XML attributes from string
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)=["']([^"']*)["']/g;

  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

/**
 * Check if content is XML workflow format
 */
function isXmlWorkflow(content: string): boolean {
  return /<(step|workflow|action|check|ask)\s/i.test(content);
}

/**
 * Facilitator Agent - follows BMAD instructions
 */
class FacilitatorAgent {
  private adapter: AnthropicAdapter;
  private config: BmadRealConfig;
  private workflow: RealWorkflowDef;

  constructor(adapter: AnthropicAdapter, config: BmadRealConfig, workflow: RealWorkflowDef) {
    this.adapter = adapter;
    this.config = config;
    this.workflow = workflow;
  }

  /**
   * Get system prompt for facilitator
   */
  private getSystemPrompt(): string {
    return `Sen deneyimli bir BMAD Facilitator'sın.
Adın: ${this.config.user_name || 'Facilitator'}
Dil: ${this.config.communication_language}

ROLÜN:
- Kolaylaştırıcı (facilitator) - içerik üretici DEĞİL
- BMAD step talimatlarını TAKİP ET
- Sorular sor, keşif yap
- Kullanıcıyla işbirliği içinde çalış

KURALLAR:
- Talimatları HARFI HARFINE takip et
- Soru sor, yanıt bekle
- İçerik üretme - sadece soruları sun
- ${this.config.communication_language} dilinde konuş`;
  }

  /**
   * Present questions from instruction
   */
  async presentQuestions(instruction: ParsedInstruction, conversationContext: string): Promise<string> {
    const prompt = `Mevcut konuşma:
${conversationContext}

---

BMAD TALİMATI (Bunu takip et):
${instruction.content}

---

Bu BMAD talimatını kullanıcıya sun:
- Talimatı oku ve anla
- Sorularını kullanıcıya sor
- Kısa ve öz ol
- Tüm soruları tek mesajda sun

${this.config.communication_language} dilinde yanıt ver.`;

    return this.generate(prompt);
  }

  /**
   * Process user response and synthesize
   */
  async processResponse(
    instruction: ParsedInstruction,
    userResponse: string,
    conversationContext: string
  ): Promise<string> {
    const prompt = `Mevcut konuşma:
${conversationContext}

---

BMAD TALİMATI:
${instruction.content}

---

Kullanıcı yanıtı:
${userResponse}

---

Bu yanıtı işle:
- Ana noktaları özetle
- Eksik bilgi varsa belirt
- Sonraki adıma hazırlık yap

Kısa ol. ${this.config.communication_language} dilinde yanıt ver.`;

    return this.generate(prompt);
  }

  /**
   * Generate content based on conversation
   */
  async generateContent(
    instruction: ParsedInstruction,
    conversationContext: string
  ): Promise<string> {
    const prompt = `Tüm konuşma:
${conversationContext}

---

BMAD TALİMATI (İçerik oluştur):
${instruction.content}

---

Bu BMAD talimatına göre içerik oluştur:
- Konuşmadaki bilgileri kullan
- Talimattaki formatı takip et
- Markdown formatında yaz
- ${this.config.document_output_language || this.config.communication_language} dilinde yaz`;

    return this.generate(prompt);
  }

  /**
   * Present menu
   */
  async presentMenu(
    instruction: ParsedInstruction,
    generatedContent: string
  ): Promise<string> {
    return `İşte oluşturduğum içerik:

${generatedContent}

---

**Seçenekler:**
[A] Advanced Elicitation - Derinleştir
[P] Party Mode - Tüm agent'larla tartış
[C] Continue - Devam et
[Y] YOLO - Otomatik tamamla`;
  }

  private async generate(prompt: string): Promise<string> {
    let response = '';
    const stream = this.adapter.stream(prompt, {
      maxTokens: 2048,
      systemPrompt: this.getSystemPrompt(),
    });

    for await (const chunk of stream) {
      response += chunk;
    }

    // Track tokens
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    tokenTracker.track(inputTokens, outputTokens);

    return response;
  }
}

/**
 * User Agent - acts as domain expert
 */
class UserAgent {
  private adapter: AnthropicAdapter;
  private projectIdea: string;
  private projectContext: string;
  private config: BmadRealConfig;

  constructor(
    adapter: AnthropicAdapter,
    projectIdea: string,
    projectContext: string,
    config: BmadRealConfig
  ) {
    this.adapter = adapter;
    this.projectIdea = projectIdea;
    this.projectContext = projectContext;
    this.config = config;
  }

  /**
   * Get system prompt for user agent
   */
  private getSystemPrompt(): string {
    return `Sen bir domain expert ve product owner'sın.
Proje fikrin: ${this.projectIdea}

ROLÜN:
- Projenin vizyonunu bilen uzman
- Sorulara detaylı ve düşünceli cevap ver
- Gerçekçi ve tutarlı ol
- Karar verebilirsin

PROJE BAĞLAMI:
${this.projectContext}

KURALLAR:
- Sorulara somut ve detaylı cevap ver
- Belirsiz cevaplar verme
- Kendi fikirlerini ekle
- ${this.config.communication_language} dilinde konuş`;
  }

  /**
   * Answer facilitator's questions
   */
  async answerQuestions(
    facilitatorMessage: string,
    conversationContext: string
  ): Promise<string> {
    const prompt = `Konuşma geçmişi:
${conversationContext}

---

Facilitator'ın soruları:
${facilitatorMessage}

---

Bu soruları "${this.projectIdea}" projesi için cevapla:
- Her soruyu düşünerek yanıtla
- Somut örnekler ver
- Detaylı ama öz ol

${this.config.communication_language} dilinde yanıt ver.`;

    let response = '';
    const stream = this.adapter.stream(prompt, {
      maxTokens: 2048,
      systemPrompt: this.getSystemPrompt(),
    });

    for await (const chunk of stream) {
      response += chunk;
    }

    // Track tokens
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    tokenTracker.track(inputTokens, outputTokens);

    return response;
  }
}

/**
 * Multi-Agent BMAD Executor
 */
export class MultiAgentBmadExecutor {
  private facilitator: FacilitatorAgent;
  private userAgent: UserAgent;
  private state: MultiAgentState;
  private adapter: AnthropicAdapter;

  constructor(
    adapter: AnthropicAdapter,
    workflow: RealWorkflowDef,
    config: BmadRealConfig,
    projectRoot: string,
    projectIdea: string,
    projectContext: string = ''
  ) {
    this.adapter = adapter;
    this.facilitator = new FacilitatorAgent(adapter, config, workflow);
    this.userAgent = new UserAgent(adapter, projectIdea, projectContext, config);

    this.state = {
      workflow,
      config,
      projectRoot,
      projectIdea,
      conversationHistory: [],
      generatedContent: new Map(),
      currentStepIndex: 0,
      stepFiles: [],
      inputDocuments: null,
    };
  }

  /**
   * Initialize execution
   */
  async initialize(): Promise<void> {
    logger.info('Multi-agent BMAD execution starting', {
      workflow: this.state.workflow.name,
      projectIdea: this.state.projectIdea.slice(0, 50),
    });

    // Find step files
    this.state.stepFiles = await findWorkflowSteps(this.state.workflow);
    logger.info('Step files found', { count: this.state.stepFiles.length });

    // Discover input documents
    const discovery = createInputDiscovery(this.state.config, this.state.projectRoot);
    this.state.inputDocuments = await discovery.discoverAll();

    if (this.state.inputDocuments.totalLoaded > 0) {
      console.log('');
      console.log(discovery.generateReport(this.state.inputDocuments));
    }

    // Check for continuation
    if (this.state.workflow.outputFile) {
      const outputPath = this.resolveVariables(this.state.workflow.outputFile);
      const { canResume, lastStep } = await documentManager.canResume(outputPath);

      if (canResume) {
        console.log('');
        p.log.info(`📂 Mevcut doküman bulundu (Adım ${lastStep})`);
        this.state.currentStepIndex = lastStep;
        this.state.outputPath = outputPath;
      }
    }
  }

  /**
   * Execute full workflow
   */
  async execute(): Promise<{ success: boolean; outputPath?: string }> {
    await this.initialize();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║ 🤖 MULTI-AGENT BMAD: ${this.state.workflow.name}`.padEnd(63) + '║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ Facilitator Agent ←→ User Agent                             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Execute each step
    while (this.state.currentStepIndex < this.state.stepFiles.length) {
      const stepFile = this.state.stepFiles[this.state.currentStepIndex];

      console.log('');
      console.log('═'.repeat(60));
      console.log(`📌 Step ${this.state.currentStepIndex + 1}/${this.state.stepFiles.length}`);

      // Load step (JIT)
      const step = await loadStepFile(stepFile);
      if (!step) {
        p.log.error(`Step yüklenemedi: ${stepFile}`);
        return { success: false };
      }

      // Execute step
      const result = await this.executeStep(step);

      if (result === 'cancel') {
        return { success: false };
      }

      if (result === 'complete') {
        break;
      }

      // Mark step completed
      if (this.state.outputPath) {
        await documentManager.completeStep(
          this.state.outputPath,
          this.state.currentStepIndex + 1
        );
      }

      this.state.currentStepIndex++;
    }

    // Mark document as completed
    if (this.state.outputPath) {
      await documentManager.markCompleted(this.state.outputPath);
    }

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║ ✅ WORKFLOW TAMAMLANDI                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Show token summary
    tokenTracker.displaySummary();

    return {
      success: true,
      outputPath: this.state.outputPath,
    };
  }

  /**
   * Execute a single step with multi-agent conversation
   */
  private async executeStep(step: RealStepDef): Promise<'continue' | 'cancel' | 'complete'> {
    logger.setWorkflowContext(this.state.workflow.name, step.name);
    tokenTracker.setContext(this.state.workflow.name, step.name);

    console.log(`   ${step.name}`);
    console.log(`   ${step.description || ''}`);
    console.log('─'.repeat(60));

    // Parse instructions
    const instructions = parseStepInstructions(step);
    logger.debug('Instructions parsed', { count: instructions.length });

    // Execute each instruction in order
    for (const instruction of instructions) {
      console.log('');
      console.log(`   📋 ${instruction.number}. ${instruction.title}`);

      const result = await this.executeInstruction(instruction);

      if (result === 'cancel') {
        return 'cancel';
      }

      if (result === 'yolo') {
        // YOLO mode - continue automatically
        continue;
      }
    }

    return 'continue';
  }

  /**
   * Execute a single instruction with agent conversation
   */
  private async executeInstruction(instruction: ParsedInstruction): Promise<'continue' | 'cancel' | 'yolo'> {
    const conversationContext = this.getConversationContext();

    // Handle XML workflow type
    if (instruction.type === 'xml-workflow') {
      return this.executeXmlInstruction(instruction);
    }

    switch (instruction.type) {
      case 'questions':
      case 'conversation': {
        // Facilitator asks questions
        console.log('');
        console.log('   🎭 Facilitator:');
        const facilitatorMessage = await this.facilitator.presentQuestions(
          instruction,
          conversationContext
        );
        console.log(this.indent(facilitatorMessage));
        this.addToConversation('facilitator', facilitatorMessage);

        // User agent responds
        console.log('');
        console.log('   👤 User Agent:');
        const userResponse = await this.userAgent.answerQuestions(
          facilitatorMessage,
          this.getConversationContext()
        );
        console.log(this.indent(userResponse));
        this.addToConversation('user', userResponse);

        // Facilitator processes response
        const synthesis = await this.facilitator.processResponse(
          instruction,
          userResponse,
          this.getConversationContext()
        );
        if (synthesis.trim()) {
          console.log('');
          console.log('   🎭 Facilitator (özet):');
          console.log(this.indent(synthesis));
          this.addToConversation('facilitator', synthesis);
        }

        return 'continue';
      }

      case 'content-generation': {
        // Generate content based on conversation
        console.log('');
        console.log('   📝 İçerik oluşturuluyor...');
        const content = await this.facilitator.generateContent(
          instruction,
          conversationContext
        );
        console.log(this.indent(content));

        // Store generated content
        this.state.generatedContent.set(instruction.title, content);

        // Append to document if we have output path
        if (this.state.outputPath) {
          await documentManager.appendContent(
            this.state.outputPath,
            content,
            instruction.title
          );
        }

        return 'continue';
      }

      case 'menu': {
        // Get all generated content for this step
        const allContent = Array.from(this.state.generatedContent.values()).join('\n\n');

        // Present menu
        const menuPresentation = await this.facilitator.presentMenu(instruction, allContent);
        console.log('');
        console.log(menuPresentation);

        // Get user choice
        const choice = await p.select({
          message: 'Seçiminiz:',
          options: [
            { value: 'c', label: '[C] Continue - Devam et' },
            { value: 'a', label: '[A] Advanced - Derinleştir' },
            { value: 'p', label: '[P] Party Mode - Agent tartışması' },
            { value: 'y', label: '[Y] YOLO - Otomatik tamamla' },
            { value: 'x', label: '[X] İptal' },
          ],
        });

        if (p.isCancel(choice) || choice === 'x') {
          return 'cancel';
        }

        if (choice === 'y') {
          return 'yolo';
        }

        if (choice === 'a' || choice === 'p') {
          // TODO: Implement advanced elicitation and party mode
          p.log.info('Bu özellik henüz implemente edilmedi, devam ediliyor...');
        }

        // Clear generated content for next step
        this.state.generatedContent.clear();

        return 'continue';
      }

      default:
        return 'continue';
    }
  }

  /**
   * Execute XML workflow instruction
   */
  private async executeXmlInstruction(instruction: ParsedInstruction): Promise<'continue' | 'cancel' | 'yolo'> {
    const conversationContext = this.getConversationContext();

    // Process tags in order
    for (const tag of instruction.tags) {
      const result = await this.executeTag(tag, conversationContext);
      if (result === 'cancel' || result === 'yolo') {
        return result;
      }
      if (result === 'goto') {
        // Handle goto - for now just continue
        continue;
      }
    }

    return 'continue';
  }

  /**
   * Execute a single BMAD tag
   */
  private async executeTag(tag: BmadTag, conversationContext: string): Promise<'continue' | 'cancel' | 'yolo' | 'goto'> {
    switch (tag.type) {
      case 'action': {
        // Check for conditional action
        if (tag.attributes['if']) {
          const condition = tag.attributes['if'];
          const shouldExecute = await this.evaluateCondition(condition, conversationContext);
          if (!shouldExecute) {
            return 'continue';
          }
        }

        // Execute the action
        console.log('');
        console.log(`   ⚡ Action: ${tag.content.slice(0, 80)}${tag.content.length > 80 ? '...' : ''}`);

        // Let facilitator handle the action
        const actionResult = await this.facilitator.generateContent(
          {
            number: 0,
            title: 'Action',
            type: 'content-generation',
            content: tag.content,
            questions: [],
            isMenu: false,
            tags: [],
          },
          conversationContext
        );

        if (actionResult.trim()) {
          console.log(this.indent(actionResult.slice(0, 500)));
          this.addToConversation('facilitator', actionResult);
        }

        return 'continue';
      }

      case 'check': {
        const condition = tag.attributes['if'];
        if (!condition) {
          // Execute children anyway
          if (tag.children) {
            for (const child of tag.children) {
              const result = await this.executeTag(child, conversationContext);
              if (result !== 'continue') return result;
            }
          }
          return 'continue';
        }

        // Evaluate condition
        const shouldExecute = await this.evaluateCondition(condition, conversationContext);

        if (shouldExecute && tag.children) {
          for (const child of tag.children) {
            const result = await this.executeTag(child, conversationContext);
            if (result !== 'continue') return result;
          }
        }

        return 'continue';
      }

      case 'ask': {
        // Present question to user agent
        console.log('');
        console.log('   🎭 Facilitator (soru):');
        console.log(this.indent(tag.content));
        this.addToConversation('facilitator', tag.content);

        // User agent responds
        console.log('');
        console.log('   👤 User Agent (cevap):');
        const response = await this.userAgent.answerQuestions(
          tag.content,
          this.getConversationContext()
        );
        console.log(this.indent(response));
        this.addToConversation('user', response);

        return 'continue';
      }

      case 'output': {
        // Display output
        console.log('');
        console.log('   📤 Output:');
        const resolvedOutput = this.resolveVariables(tag.content);
        console.log(this.indent(resolvedOutput));
        return 'continue';
      }

      case 'goto': {
        const stepTarget = tag.attributes['step'] || tag.attributes['anchor'];
        console.log(`   ➡️ Goto: ${stepTarget}`);
        // For now, just note the goto - actual jump handling would require more complex state
        return 'goto';
      }

      case 'anchor': {
        // Anchors are just markers, no action needed
        return 'continue';
      }

      case 'critical': {
        // Display critical instruction
        console.log('');
        console.log('   ⚠️ CRITICAL:');
        console.log(this.indent(tag.content));
        return 'continue';
      }

      case 'template-output': {
        // Generate content and show menu
        console.log('');
        console.log('   📝 Template Output oluşturuluyor...');

        const content = await this.facilitator.generateContent(
          {
            number: 0,
            title: 'Template Output',
            type: 'content-generation',
            content: tag.content,
            questions: [],
            isMenu: false,
            tags: [],
          },
          this.getConversationContext()
        );

        console.log(this.indent(content.slice(0, 1000)));

        // Save to document if we have output path
        if (this.state.outputPath) {
          await documentManager.appendContent(
            this.state.outputPath,
            content,
            'Template Output'
          );
        }

        // Show A/P/C/Y menu
        const choice = await p.select({
          message: 'Seçiminiz:',
          options: [
            { value: 'c', label: '[C] Continue - Devam et' },
            { value: 'a', label: '[A] Advanced - Derinleştir' },
            { value: 'p', label: '[P] Party Mode - Agent tartışması' },
            { value: 'y', label: '[Y] YOLO - Otomatik tamamla' },
          ],
        });

        if (p.isCancel(choice)) {
          return 'cancel';
        }

        if (choice === 'y') {
          return 'yolo';
        }

        return 'continue';
      }

      case 'invoke-workflow': {
        const workflowPath = tag.attributes['path'] || tag.content;
        console.log(`   🔄 Invoke Workflow: ${workflowPath}`);
        // TODO: Actually invoke the sub-workflow
        return 'continue';
      }

      case 'invoke-task': {
        const taskPath = tag.attributes['path'] || tag.content;
        console.log(`   📋 Invoke Task: ${taskPath}`);
        // TODO: Actually invoke the task
        return 'continue';
      }

      case 'invoke-protocol': {
        const protocolName = tag.attributes['name'];
        console.log(`   🔧 Invoke Protocol: ${protocolName}`);

        if (protocolName === 'discover_inputs') {
          // Execute discover_inputs protocol
          if (this.state.inputDocuments && this.state.inputDocuments.totalLoaded > 0) {
            console.log('   ✅ Input documents already discovered');
          }
        }

        return 'continue';
      }

      case 'iterate': {
        // Handle iteration
        console.log(`   🔁 Iterate: ${tag.content}`);
        // For now, just process children once
        if (tag.children) {
          for (const child of tag.children) {
            const result = await this.executeTag(child, this.getConversationContext());
            if (result !== 'continue') return result;
          }
        }
        return 'continue';
      }

      case 'step':
      case 'substep': {
        // Process children of step/substep
        console.log('');
        console.log(`   📌 ${tag.attributes['n'] ? `Step ${tag.attributes['n']}` : 'Substep'}: ${tag.attributes['goal'] || tag.attributes['title'] || ''}`);

        if (tag.children) {
          for (const child of tag.children) {
            const result = await this.executeTag(child, this.getConversationContext());
            if (result !== 'continue') return result;
          }
        }

        return 'continue';
      }

      default:
        return 'continue';
    }
  }

  /**
   * Evaluate a condition string
   */
  private async evaluateCondition(condition: string, conversationContext: string): Promise<boolean> {
    // Simple condition evaluation
    // For complex conditions, ask the facilitator to evaluate

    // Check for simple variable conditions
    const varMatch = condition.match(/\{\{(\w+)\}\}\s*(==|!=|is|is not)\s*["']?(\w+)["']?/i);
    if (varMatch) {
      const varName = varMatch[1];
      const operator = varMatch[2].toLowerCase();
      const expectedValue = varMatch[3];

      const actualValue = this.state.config[varName as keyof typeof this.state.config] || '';

      if (operator === '==' || operator === 'is') {
        return actualValue === expectedValue;
      } else {
        return actualValue !== expectedValue;
      }
    }

    // Check for existence conditions
    if (condition.includes('exists') || condition.includes('provided')) {
      // For now, assume condition is met
      return true;
    }

    // Check for NOT conditions
    if (condition.includes('NOT') || condition.includes('no ')) {
      // For now, return false for NOT conditions
      return false;
    }

    // Default: let AI decide
    const prompt = `Condition to evaluate: "${condition}"

Based on the conversation context, should this condition be considered TRUE or FALSE?
Answer only "true" or "false".

Context:
${conversationContext.slice(-2000)}`;

    let response = '';
    const stream = this.adapter.stream(prompt, {
      maxTokens: 10,
      systemPrompt: 'You are a condition evaluator. Answer only "true" or "false".',
    });

    for await (const chunk of stream) {
      response += chunk;
    }

    return response.toLowerCase().includes('true');
  }

  /**
   * Add turn to conversation history
   */
  private addToConversation(role: 'facilitator' | 'user', content: string): void {
    this.state.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get conversation context string
   */
  private getConversationContext(): string {
    return this.state.conversationHistory
      .slice(-10) // Last 10 turns
      .map(turn => `[${turn.role.toUpperCase()}]: ${turn.content}`)
      .join('\n\n');
  }

  /**
   * Resolve variables in string
   */
  private resolveVariables(str: string): string {
    let result = str;

    for (const [key, value] of Object.entries(this.state.config)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    result = result.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
    result = result.replace(/\{project-root\}/g, this.state.projectRoot);

    return result;
  }

  /**
   * Indent text for display
   */
  private indent(text: string, spaces: number = 6): string {
    const indent = ' '.repeat(spaces);
    return text.split('\n').map(line => indent + line).join('\n');
  }
}

/**
 * Run multi-agent BMAD workflow
 */
export async function executeMultiAgentBmad(
  adapter: AnthropicAdapter,
  workflow: RealWorkflowDef,
  config: BmadRealConfig,
  projectRoot: string,
  projectIdea: string,
  projectContext: string = ''
): Promise<{ success: boolean; outputPath?: string }> {
  const executor = new MultiAgentBmadExecutor(
    adapter,
    workflow,
    config,
    projectRoot,
    projectIdea,
    projectContext
  );

  return executor.execute();
}
