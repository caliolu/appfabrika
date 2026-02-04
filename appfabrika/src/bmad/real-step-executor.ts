/**
 * Real BMAD Step Executor
 * Executes steps following the actual BMAD methodology:
 * - Just-in-time step loading
 * - Sequential execution
 * - A/P/C/Y menu system
 * - Frontmatter tracking
 * - Continuation support
 */

import * as p from '@clack/prompts';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import {
  type RealWorkflowDef,
  type RealStepDef,
  loadStepFile,
  findWorkflowSteps,
  type BmadRealConfig,
} from './real-workflow-loader.js';
import { documentManager, type DocumentState } from './document-manager.js';
import { createInputDiscovery, type DiscoveryResult } from './input-discovery.js';
import { logger } from './logger.js';
import { tokenTracker } from './token-tracker.js';
import { runAdvancedElicitation } from './template-engine.js';

/**
 * Execution state
 */
export interface ExecutionState {
  workflow: RealWorkflowDef;
  config: BmadRealConfig;
  projectRoot: string;
  currentStepIndex: number;
  stepFiles: string[];
  outputDocument?: DocumentState;
  inputDocuments: DiscoveryResult | null;
  yoloMode: boolean;
  variables: Map<string, string>;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  success: boolean;
  output: string;
  nextStepFile?: string;
  action: 'continue' | 'advanced' | 'party' | 'yolo' | 'cancel' | 'complete';
}

/**
 * Real Step Executor class
 */
export class RealStepExecutor {
  private adapter: AnthropicAdapter;
  private state: ExecutionState;

  constructor(
    adapter: AnthropicAdapter,
    workflow: RealWorkflowDef,
    config: BmadRealConfig,
    projectRoot: string
  ) {
    this.adapter = adapter;
    this.state = {
      workflow,
      config,
      projectRoot,
      currentStepIndex: 0,
      stepFiles: [],
      inputDocuments: null,
      yoloMode: false,
      variables: new Map(),
    };

    // Initialize variables from config
    for (const [key, value] of Object.entries(config)) {
      this.state.variables.set(key, value);
    }
    for (const [key, value] of Object.entries(workflow.variables)) {
      this.state.variables.set(key, value);
    }
  }

  /**
   * Initialize execution
   */
  async initialize(): Promise<void> {
    logger.info('Initializing workflow execution', { workflow: this.state.workflow.name });

    // Find all step files
    this.state.stepFiles = await findWorkflowSteps(this.state.workflow);

    if (this.state.stepFiles.length === 0) {
      logger.warn('No step files found for workflow', { workflow: this.state.workflow.name });
    }

    // Check for output file and continuation
    if (this.state.workflow.outputFile) {
      const outputPath = this.resolveVariables(this.state.workflow.outputFile);
      const { canResume, lastStep } = await documentManager.canResume(outputPath);

      if (canResume) {
        console.log('');
        p.log.info(`📂 Mevcut doküman bulundu. Son tamamlanan adım: ${lastStep}`);

        const choice = await p.select({
          message: 'Ne yapmak istersin?',
          options: [
            { value: 'resume', label: '🔄 Kaldığı yerden devam et' },
            { value: 'restart', label: '🆕 Baştan başla' },
          ],
        });

        if (!p.isCancel(choice) && choice === 'resume') {
          this.state.currentStepIndex = lastStep;
          this.state.outputDocument = await documentManager.loadDocument(outputPath);
          p.log.success(`✅ Adım ${lastStep + 1}'den devam ediliyor`);
        }
      }
    }

    // Discover input documents
    const discovery = createInputDiscovery(this.state.config, this.state.projectRoot);
    this.state.inputDocuments = await discovery.discoverAll();

    if (this.state.inputDocuments.totalLoaded > 0) {
      console.log('');
      console.log(discovery.generateReport(this.state.inputDocuments));
    }
  }

  /**
   * Execute workflow
   */
  async execute(): Promise<{ success: boolean; outputPath?: string }> {
    await this.initialize();

    console.log('');
    console.log('═'.repeat(60));
    console.log(`🏭 ${this.state.workflow.name.toUpperCase()}`);
    console.log(`   ${this.state.workflow.description}`);
    console.log('═'.repeat(60));

    // Execute steps one by one (JIT loading)
    while (this.state.currentStepIndex < this.state.stepFiles.length) {
      const stepFile = this.state.stepFiles[this.state.currentStepIndex];

      logger.info('Loading step', {
        index: this.state.currentStepIndex + 1,
        total: this.state.stepFiles.length,
        file: stepFile,
      });

      // Load step (JIT)
      const step = await loadStepFile(stepFile);
      if (!step) {
        p.log.error(`Step dosyası yüklenemedi: ${stepFile}`);
        return { success: false };
      }

      // Execute step
      const result = await this.executeStep(step);

      if (result.action === 'cancel') {
        p.log.warn('Workflow iptal edildi');
        return { success: false };
      }

      if (result.action === 'complete') {
        break;
      }

      if (result.action === 'yolo') {
        this.state.yoloMode = true;
        p.log.info('🚀 YOLO modu aktif - otomatik devam');
      }

      // Mark step completed in document
      if (this.state.outputDocument) {
        await documentManager.completeStep(
          this.state.outputDocument.path,
          this.state.currentStepIndex + 1
        );
      }

      // Move to next step
      if (result.nextStepFile) {
        // Find the next step file by name
        const nextIndex = this.state.stepFiles.findIndex(f =>
          f.includes(result.nextStepFile!)
        );
        if (nextIndex >= 0) {
          this.state.currentStepIndex = nextIndex;
        } else {
          this.state.currentStepIndex++;
        }
      } else {
        this.state.currentStepIndex++;
      }
    }

    // Mark document as completed
    if (this.state.outputDocument) {
      await documentManager.markCompleted(this.state.outputDocument.path);
    }

    console.log('');
    console.log('═'.repeat(60));
    p.log.success(`✅ ${this.state.workflow.name} tamamlandı!`);
    console.log('═'.repeat(60));

    return {
      success: true,
      outputPath: this.state.outputDocument?.path,
    };
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: RealStepDef): Promise<StepExecutionResult> {
    logger.setWorkflowContext(this.state.workflow.name, step.name);
    tokenTracker.setContext(this.state.workflow.name, step.name);

    console.log('');
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log(`│ 📌 ${step.name}`.padEnd(59) + '│');
    if (step.description) {
      console.log(`│    ${step.description.slice(0, 50)}`.padEnd(59) + '│');
    }
    console.log('└' + '─'.repeat(58) + '┘');

    // Build context for AI
    const context = this.buildContext(step);

    // Generate content for this step
    const output = await this.generateStepContent(step, context);

    // Handle output file if specified
    if (step.outputFile && !this.state.outputDocument) {
      const outputPath = this.resolveVariables(step.outputFile);

      if (step.templateRef) {
        const templatePath = this.resolveVariables(step.templateRef);
        this.state.outputDocument = await documentManager.createFromTemplate(
          outputPath,
          templatePath,
          Object.fromEntries(this.state.variables)
        );
      } else {
        this.state.outputDocument = await documentManager.loadDocument(outputPath);
      }
    }

    // Append content to document
    if (this.state.outputDocument && output) {
      await documentManager.appendContent(
        this.state.outputDocument.path,
        output,
        step.name
      );
    }

    // Show A/P/C/Y menu (unless YOLO mode)
    if (this.state.yoloMode) {
      return {
        success: true,
        output,
        nextStepFile: step.nextStepFile,
        action: 'continue',
      };
    }

    return await this.showStepMenu(step, output);
  }

  /**
   * Build context string from input documents
   */
  private buildContext(step: RealStepDef): string {
    const parts: string[] = [];

    // Add project info
    parts.push(`Proje: ${this.state.config.project_name}`);
    parts.push(`Kullanıcı: ${this.state.config.user_name}`);
    parts.push(`Dil: ${this.state.config.communication_language}`);
    parts.push('');

    // Add step info
    parts.push(`Adım: ${step.name}`);
    if (step.goal) {
      parts.push(`Hedef: ${step.goal}`);
    }
    parts.push('');

    // Add input documents
    if (this.state.inputDocuments && this.state.inputDocuments.totalLoaded > 0) {
      parts.push('--- INPUT DOCUMENTS ---');
      for (const doc of this.state.inputDocuments.documents) {
        if (doc.content) {
          parts.push(`\n### ${doc.name} (${doc.type})\n`);
          parts.push(doc.content.slice(0, 3000)); // Limit content
        }
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Generate content for a step using AI
   */
  private async generateStepContent(step: RealStepDef, context: string): Promise<string> {
    const systemPrompt = `Sen deneyimli bir ${this.state.workflow.phase} uzmanısın.
BMAD metodolojisini kullanarak "${this.state.workflow.name}" workflow'unu yürütüyorsun.

Rolün: Kolaylaştırıcı - içerik üretici değil, keşif rehberi.
Kullanıcıyla işbirliği içinde çalış, sorular sor, geri bildirim al.

Dil: ${this.state.config.communication_language}
Kullanıcı: ${this.state.config.user_name}

KURALLAR:
- Kısa ve öz ol
- Somut öneriler ver
- Kullanıcının domain bilgisine güven
- Sorular sorarak keşif yap`;

    const prompt = `${context}

---

ADIM İÇERİĞİ:
${step.content}

---

Bu adımı kullanıcıyla işbirliği içinde tamamla.
${this.state.config.communication_language} dilinde yanıt ver.
Markdown formatında yaz.`;

    console.log('');
    console.log('🤖 AI yanıtı oluşturuluyor...');
    console.log('');

    let fullContent = '';
    const startTime = Date.now();

    const stream = this.adapter.stream(prompt, {
      maxTokens: 4096,
      systemPrompt,
    });

    for await (const chunk of stream) {
      process.stdout.write(chunk);
      fullContent += chunk;
    }

    const duration = Date.now() - startTime;
    const inputTokens = Math.ceil((prompt.length + systemPrompt.length) / 4);
    const outputTokens = Math.ceil(fullContent.length / 4);

    tokenTracker.track(inputTokens, outputTokens);
    logger.debug('Step content generated', { duration, inputTokens, outputTokens });

    console.log('');
    console.log('─'.repeat(60));

    return fullContent;
  }

  /**
   * Show A/P/C/Y menu
   */
  private async showStepMenu(step: RealStepDef, output: string): Promise<StepExecutionResult> {
    console.log('');

    const choice = await p.select({
      message: 'Nasıl devam etmek istersin?',
      options: [
        { value: 'c', label: '[C] Devam Et', hint: 'Sonraki adıma geç' },
        { value: 'a', label: '[A] Advanced Elicitation', hint: '50+ teknikle derinleştir' },
        { value: 'p', label: '[P] Party Mode', hint: 'Tüm agent\'larla tartış' },
        { value: 'y', label: '[Y] YOLO', hint: 'Otomatik tamamla' },
        { value: 'e', label: '[E] Düzenle', hint: 'İçeriği düzenle' },
        { value: 'x', label: '[X] İptal', hint: 'Workflow\'u iptal et' },
      ],
    });

    if (p.isCancel(choice) || choice === 'x') {
      return { success: false, output, action: 'cancel' };
    }

    switch (choice) {
      case 'c':
        return {
          success: true,
          output,
          nextStepFile: step.nextStepFile,
          action: 'continue',
        };

      case 'a':
        // Run advanced elicitation
        const enhanced = await runAdvancedElicitation(
          output,
          step.name,
          {
            idea: this.state.config.project_name,
            workflow: { meta: { name: this.state.workflow.name } } as any,
            previousOutputs: new Map(),
            phase: this.state.workflow.phase as any,
          },
          this.adapter
        );
        return {
          success: true,
          output: enhanced,
          action: 'advanced',
        };

      case 'p':
        p.log.info('🎉 Party Mode henüz bu executor\'da implemente edilmedi');
        return {
          success: true,
          output,
          action: 'party',
        };

      case 'y':
        return {
          success: true,
          output,
          nextStepFile: step.nextStepFile,
          action: 'yolo',
        };

      case 'e':
        const edited = await p.text({
          message: 'Düzenleme notlarınız:',
          placeholder: 'Neyi değiştirmek istiyorsunuz?',
        });

        if (!p.isCancel(edited) && edited) {
          // Re-generate with edits
          const revisedOutput = await this.reviseContent(output, edited as string, step);
          return {
            success: true,
            output: revisedOutput,
            action: 'continue',
          };
        }
        return { success: true, output, action: 'continue' };

      default:
        return { success: true, output, action: 'continue' };
    }
  }

  /**
   * Revise content based on user feedback
   */
  private async reviseContent(
    originalContent: string,
    feedback: string,
    step: RealStepDef
  ): Promise<string> {
    const prompt = `Orijinal içerik:
${originalContent}

---

Kullanıcı geri bildirimi:
${feedback}

---

Bu geri bildirime göre içeriği düzenle.
${this.state.config.communication_language} dilinde yanıt ver.`;

    console.log('');
    console.log('🔄 İçerik düzenleniyor...');
    console.log('');

    let revised = '';
    const stream = this.adapter.stream(prompt, {
      maxTokens: 4096,
      systemPrompt: 'Sen yardımcı bir editörsün. İçeriği kullanıcı geri bildirimine göre düzenle.',
    });

    for await (const chunk of stream) {
      process.stdout.write(chunk);
      revised += chunk;
    }

    console.log('');
    console.log('─'.repeat(60));

    return revised;
  }

  /**
   * Resolve variables in a string
   */
  private resolveVariables(str: string): string {
    let result = str;

    // Replace {{var}} and {var}
    for (const [key, value] of this.state.variables.entries()) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    // Replace {{date}}
    result = result.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);

    return result;
  }
}

/**
 * Create and run a workflow
 */
export async function executeRealWorkflow(
  adapter: AnthropicAdapter,
  workflow: RealWorkflowDef,
  config: BmadRealConfig,
  projectRoot: string
): Promise<{ success: boolean; outputPath?: string }> {
  const executor = new RealStepExecutor(adapter, workflow, config, projectRoot);
  return executor.execute();
}
