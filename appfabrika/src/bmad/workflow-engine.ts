/**
 * BMAD Workflow Engine
 * Quality Gates, Auto-Fix, Real Code Generation, Iterative Improvement
 */

import * as p from '@clack/prompts';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import type { ExecutionContext, BmadPhase } from './types.js';
import {
  calculatePRDQuality,
  calculateArchitectureQuality,
  calculateStoryINVESTScore,
  runAdversarialReview,
  type QualityScore,
  type AdversarialFinding,
} from './advanced-features.js';

// ============================================================================
// QUALITY GATES - Kalite Kapıları
// ============================================================================

export interface QualityGateConfig {
  minScore: number;
  maxRetries: number;
  autoFix: boolean;
}

export const DEFAULT_QUALITY_GATES: Record<string, QualityGateConfig> = {
  'create-prd': { minScore: 70, maxRetries: 3, autoFix: true },
  'create-architecture': { minScore: 70, maxRetries: 3, autoFix: true },
  'create-epics-stories': { minScore: 70, maxRetries: 3, autoFix: true },
  'create-story': { minScore: 65, maxRetries: 2, autoFix: true },
  'code-review': { minScore: 75, maxRetries: 3, autoFix: true },
};

export interface QualityGateResult {
  passed: boolean;
  score: number;
  grade: string;
  attempts: number;
  improvements: string[];
}

/**
 * Stream AI response
 */
async function streamResponse(
  adapter: AnthropicAdapter,
  prompt: string,
  systemPrompt: string,
  showOutput: boolean = true
): Promise<string> {
  let fullContent = '';

  const stream = adapter.stream(prompt, {
    maxTokens: 4096,
    systemPrompt,
  });

  for await (const chunk of stream) {
    if (showOutput) {
      process.stdout.write(chunk);
    }
    fullContent += chunk;
  }

  if (showOutput) {
    console.log('');
  }

  return fullContent;
}

/**
 * Run quality gate check with auto-fix loop
 */
export async function runQualityGate(
  workflowId: string,
  content: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ result: QualityGateResult; improvedContent: string }> {
  const config = DEFAULT_QUALITY_GATES[workflowId] || { minScore: 60, maxRetries: 2, autoFix: true };

  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🚦 QUALITY GATE'.padEnd(59) + '║');
    console.log(`║ Minimum skor: ${config.minScore} | Max deneme: ${config.maxRetries}`.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  let currentContent = content;
  let attempts = 0;
  let currentScore: QualityScore = { overall: 0, categories: [], grade: 'F', summary: '' };
  const improvements: string[] = [];

  while (attempts < config.maxRetries) {
    attempts++;

    if (showOutput) {
      console.log(`\n🔄 Deneme ${attempts}/${config.maxRetries}`);
    }

    // Calculate quality score based on workflow type
    if (workflowId.includes('prd')) {
      currentScore = await calculatePRDQuality(currentContent, adapter, showOutput);
    } else if (workflowId.includes('architecture')) {
      currentScore = await calculateArchitectureQuality(currentContent, adapter, showOutput);
    } else if (workflowId.includes('story')) {
      currentScore = await calculateStoryINVESTScore(currentContent, adapter, showOutput);
    } else {
      // Generic quality check
      currentScore = await calculatePRDQuality(currentContent, adapter, showOutput);
    }

    if (showOutput) {
      console.log(`\n📊 Skor: ${currentScore.overall}/100 (${currentScore.grade})`);
    }

    // Check if passed
    if (currentScore.overall >= config.minScore) {
      if (showOutput) {
        p.log.success(`✅ Quality gate geçildi! (${currentScore.overall} >= ${config.minScore})`);
      }
      return {
        result: {
          passed: true,
          score: currentScore.overall,
          grade: currentScore.grade,
          attempts,
          improvements,
        },
        improvedContent: currentContent,
      };
    }

    // If not passed and auto-fix enabled
    if (config.autoFix && attempts < config.maxRetries) {
      if (showOutput) {
        console.log(`\n⚠️ Skor yetersiz (${currentScore.overall} < ${config.minScore})`);
        console.log('🔧 Otomatik iyileştirme başlatılıyor...');
      }

      // Get issues to fix
      const issues = currentScore.categories
        .filter(c => c.score < c.maxScore * 0.7)
        .flatMap(c => c.issues);

      // Auto-fix content
      const fixResult = await autoFixContent(
        currentContent,
        issues,
        workflowId,
        adapter,
        showOutput
      );

      currentContent = fixResult.improvedContent;
      improvements.push(...fixResult.changes);

      if (showOutput) {
        console.log(`\n✨ ${fixResult.changes.length} iyileştirme yapıldı`);
      }
    }
  }

  // Failed after all retries
  if (showOutput) {
    p.log.error(`❌ Quality gate geçilemedi! (${currentScore.overall} < ${config.minScore})`);
  }

  return {
    result: {
      passed: false,
      score: currentScore.overall,
      grade: currentScore.grade,
      attempts,
      improvements,
    },
    improvedContent: currentContent,
  };
}

// ============================================================================
// AUTO-FIX LOOP - Otomatik Düzeltme Döngüsü
// ============================================================================

export interface AutoFixResult {
  improvedContent: string;
  changes: string[];
  iterations: number;
}

/**
 * Auto-fix content based on issues
 */
export async function autoFixContent(
  content: string,
  issues: string[],
  contentType: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<AutoFixResult> {
  if (showOutput) {
    console.log('');
    console.log('🔧 AUTO-FIX BAŞLADI');
    console.log(`📋 ${issues.length} sorun düzeltilecek`);
  }

  const systemPrompt = `Sen bir içerik iyileştirme uzmanısın.
Verilen sorunları düzelt ve içeriği iyileştir.
Orijinal yapıyı koru, sadece sorunlu kısımları düzelt.
Her değişikliği açıkla.`;

  const prompt = `İçerik Tipi: ${contentType}

Mevcut İçerik:
${content}

---

Düzeltilmesi Gereken Sorunlar:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

---

Lütfen:
1. Her sorunu tek tek düzelt
2. İyileştirilmiş içeriği üret
3. Yaptığın değişiklikleri listele

Format:
## İYİLEŞTİRİLMİŞ İÇERİK
[düzeltilmiş içerik]

## YAPILAN DEĞİŞİKLİKLER
- Değişiklik 1
- Değişiklik 2
...`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  // Parse improved content
  const contentMatch = response.match(/## İYİLEŞTİRİLMİŞ İÇERİK\n([\s\S]*?)(?=## YAPILAN DEĞİŞİKLİKLER|$)/);
  const changesMatch = response.match(/## YAPILAN DEĞİŞİKLİKLER\n([\s\S]*?)$/);

  const improvedContent = contentMatch ? contentMatch[1].trim() : content;
  const changes = changesMatch
    ? changesMatch[1].split('\n').filter(l => l.startsWith('-')).map(l => l.slice(2).trim())
    : [];

  return {
    improvedContent,
    changes,
    iterations: 1,
  };
}

/**
 * Review and fix loop - run until all issues resolved or max iterations
 */
export async function reviewAndFixLoop(
  content: string,
  contentType: 'prd' | 'architecture' | 'code' | 'story' | 'general',
  adapter: AnthropicAdapter,
  maxIterations: number = 3,
  showOutput: boolean = true
): Promise<{ finalContent: string; allFindings: AdversarialFinding[]; iterations: number }> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🔄 REVIEW & FIX LOOP'.padEnd(59) + '║');
    console.log(`║ Max iterasyon: ${maxIterations}`.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  let currentContent = content;
  let allFindings: AdversarialFinding[] = [];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    if (showOutput) {
      console.log(`\n━━━ İterasyon ${iteration}/${maxIterations} ━━━`);
    }

    // Run adversarial review
    const review = await runAdversarialReview(currentContent, contentType, adapter, showOutput);
    allFindings = [...allFindings, ...review.findings];

    // Count critical and major issues
    const criticalCount = review.findings.filter(f => f.severity === 'critical').length;
    const majorCount = review.findings.filter(f => f.severity === 'major').length;

    if (showOutput) {
      console.log(`\n📊 Bulgular: ${criticalCount} kritik, ${majorCount} major, ${review.findings.length - criticalCount - majorCount} minor`);
    }

    // If no critical or major issues, we're done
    if (criticalCount === 0 && majorCount === 0) {
      if (showOutput) {
        p.log.success(`✅ Tüm kritik ve major sorunlar çözüldü! (${iteration} iterasyon)`);
      }
      return { finalContent: currentContent, allFindings, iterations: iteration };
    }

    // Fix the issues
    if (iteration < maxIterations) {
      if (showOutput) {
        console.log('\n🔧 Sorunlar düzeltiliyor...');
      }

      const issueDescriptions = review.findings
        .filter(f => f.severity === 'critical' || f.severity === 'major')
        .map(f => `[${f.severity}] ${f.finding}: ${f.recommendation}`);

      const fixResult = await autoFixContent(
        currentContent,
        issueDescriptions,
        contentType,
        adapter,
        showOutput
      );

      currentContent = fixResult.improvedContent;

      if (showOutput) {
        console.log(`✨ ${fixResult.changes.length} düzeltme yapıldı`);
      }
    }
  }

  if (showOutput) {
    p.log.warn(`⚠️ Max iterasyona ulaşıldı (${maxIterations}). Bazı sorunlar kalmış olabilir.`);
  }

  return { finalContent: currentContent, allFindings, iterations: iteration };
}

// ============================================================================
// REAL CODE GENERATION - Gerçek Kod Üretimi
// ============================================================================

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

/**
 * Generate and write actual code files to disk
 */
export async function generateAndWriteCode(
  projectPath: string,
  projectName: string,
  architecture: string,
  techStack: string[],
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ files: GeneratedFile[]; success: boolean }> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🏗️ KOD ÜRETİMİ VE YAZIMI'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const generatedFiles: GeneratedFile[] = [];

  // 1. Generate project structure
  if (showOutput) {
    console.log('\n📁 Proje yapısı oluşturuluyor...');
  }

  const structurePrompt = `Proje: ${projectName}
Teknoloji: ${techStack.join(', ')}
Mimari: ${architecture.slice(0, 2000)}

Proje yapısı için gerekli dosyaları oluştur.
Her dosya için tam içerik ver.

JSON formatında yanıt ver:
{
  "files": [
    {
      "path": "package.json",
      "content": "{ \\"name\\": \\"...\\" }",
      "description": "NPM package config"
    }
  ]
}`;

  const structureResponse = await streamResponse(
    adapter,
    structurePrompt,
    'Sen bir proje scaffolding uzmanısın. Gerçek, çalışan kod üret.',
    showOutput
  );

  // Parse and write files
  try {
    const jsonMatch = structureResponse.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const file of parsed.files) {
        generatedFiles.push(file);
      }
    }
  } catch (e) {
    // Generate default structure if parsing fails
    generatedFiles.push(
      { path: 'package.json', content: `{\n  "name": "${projectName.toLowerCase().replace(/\s+/g, '-')}",\n  "version": "0.1.0",\n  "type": "module"\n}`, description: 'NPM config' },
      { path: 'tsconfig.json', content: '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "strict": true\n  }\n}', description: 'TypeScript config' },
      { path: 'src/index.ts', content: `// ${projectName}\nconsole.log("Hello World");`, description: 'Entry point' },
      { path: '.gitignore', content: 'node_modules/\ndist/\n.env\n*.log', description: 'Git ignore' },
      { path: 'README.md', content: `# ${projectName}\n\n${architecture.slice(0, 500)}`, description: 'Documentation' },
    );
  }

  // 2. Write files to disk
  if (showOutput) {
    console.log(`\n💾 ${generatedFiles.length} dosya yazılıyor...`);
  }

  let successCount = 0;
  for (const file of generatedFiles) {
    try {
      const fullPath = join(projectPath, file.path);
      const dir = dirname(fullPath);

      // Create directory if needed
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Write file
      await writeFile(fullPath, file.content, 'utf-8');
      successCount++;

      if (showOutput) {
        console.log(`  ✅ ${file.path}`);
      }
    } catch (error) {
      if (showOutput) {
        console.log(`  ❌ ${file.path}: ${error}`);
      }
    }
  }

  if (showOutput) {
    console.log(`\n📊 ${successCount}/${generatedFiles.length} dosya başarıyla yazıldı`);
  }

  return {
    files: generatedFiles,
    success: successCount === generatedFiles.length,
  };
}

/**
 * Generate API endpoint files
 */
export async function generateAPIFiles(
  projectPath: string,
  entities: string[],
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<GeneratedFile[]> {
  if (showOutput) {
    console.log('\n🔌 API dosyaları oluşturuluyor...');
  }

  const files: GeneratedFile[] = [];

  for (const entity of entities) {
    const entityLower = entity.toLowerCase();
    const entityCapital = entity.charAt(0).toUpperCase() + entity.slice(1);

    // Generate controller
    const controllerContent = `/**
 * ${entityCapital} Controller
 * Auto-generated by BMAD
 */

import { Router, Request, Response } from 'express';

const router = Router();

// GET all ${entityLower}s
router.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: Implement get all ${entityLower}s
    res.json({ message: 'Get all ${entityLower}s' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET ${entityLower} by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Implement get ${entityLower} by id
    res.json({ message: \`Get ${entityLower} \${id}\` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create ${entityLower}
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    // TODO: Implement create ${entityLower}
    res.status(201).json({ message: 'Created ${entityLower}', data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update ${entityLower}
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    // TODO: Implement update ${entityLower}
    res.json({ message: \`Updated ${entityLower} \${id}\`, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE ${entityLower}
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Implement delete ${entityLower}
    res.json({ message: \`Deleted ${entityLower} \${id}\` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
`;

    const controllerPath = `src/routes/${entityLower}.routes.ts`;
    files.push({
      path: controllerPath,
      content: controllerContent,
      description: `${entityCapital} API endpoints`,
    });

    // Write file
    const fullPath = join(projectPath, controllerPath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, controllerContent, 'utf-8');

    if (showOutput) {
      console.log(`  ✅ ${controllerPath}`);
    }
  }

  return files;
}

/**
 * Generate test files
 */
export async function generateTestFiles(
  projectPath: string,
  features: string[],
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<GeneratedFile[]> {
  if (showOutput) {
    console.log('\n🧪 Test dosyaları oluşturuluyor...');
  }

  const files: GeneratedFile[] = [];

  for (const feature of features) {
    const featureLower = feature.toLowerCase().replace(/\s+/g, '-');
    const testContent = `/**
 * ${feature} Tests
 * Auto-generated by BMAD
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('${feature}', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('basic functionality', () => {
    it('should exist', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });

    it('should handle valid input', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });

    it('should handle invalid input', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });

    it('should handle null/undefined', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid state', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });
  });
});
`;

    const testPath = `tests/${featureLower}.test.ts`;
    files.push({
      path: testPath,
      content: testContent,
      description: `${feature} test suite`,
    });

    // Write file
    const fullPath = join(projectPath, testPath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, testContent, 'utf-8');

    if (showOutput) {
      console.log(`  ✅ ${testPath}`);
    }
  }

  return files;
}

// ============================================================================
// WORKFLOW BLOCKING - Workflow Engelleme
// ============================================================================

export interface WorkflowDependency {
  workflowId: string;
  requiredWorkflows: string[];
  qualityGate?: boolean;
  minScore?: number;
}

export const WORKFLOW_DEPENDENCIES: WorkflowDependency[] = [
  // Planning phase depends on analysis
  { workflowId: 'create-prd', requiredWorkflows: ['create-product-brief'], qualityGate: true, minScore: 70 },
  { workflowId: 'create-ux-design', requiredWorkflows: ['create-prd'], qualityGate: true, minScore: 70 },

  // Solutioning depends on planning
  { workflowId: 'create-architecture', requiredWorkflows: ['create-prd'], qualityGate: true, minScore: 70 },
  { workflowId: 'create-epics-stories', requiredWorkflows: ['create-prd', 'create-architecture'], qualityGate: true, minScore: 70 },

  // Implementation depends on solutioning
  { workflowId: 'sprint-planning', requiredWorkflows: ['create-epics-stories', 'check-implementation-readiness'], qualityGate: true, minScore: 70 },
  { workflowId: 'dev-story', requiredWorkflows: ['create-story'], qualityGate: false },
  { workflowId: 'code-review', requiredWorkflows: ['dev-story'], qualityGate: true, minScore: 75 },
  { workflowId: 'qa-automate', requiredWorkflows: ['dev-story'], qualityGate: false },
];

/**
 * Check if workflow can proceed based on dependencies
 */
export function canWorkflowProceed(
  workflowId: string,
  completedWorkflows: Set<string>,
  workflowScores: Map<string, number>
): { canProceed: boolean; blockers: string[]; reason?: string } {
  const dependency = WORKFLOW_DEPENDENCIES.find(d => d.workflowId === workflowId);

  if (!dependency) {
    return { canProceed: true, blockers: [] };
  }

  const blockers: string[] = [];

  // Check required workflows
  for (const required of dependency.requiredWorkflows) {
    if (!completedWorkflows.has(required)) {
      blockers.push(`${required} tamamlanmamış`);
    }
  }

  // Check quality gate
  if (dependency.qualityGate && dependency.minScore) {
    for (const required of dependency.requiredWorkflows) {
      const score = workflowScores.get(required);
      if (score !== undefined && score < dependency.minScore) {
        blockers.push(`${required} kalite skoru yetersiz (${score} < ${dependency.minScore})`);
      }
    }
  }

  return {
    canProceed: blockers.length === 0,
    blockers,
    reason: blockers.length > 0 ? blockers.join(', ') : undefined,
  };
}

/**
 * Get next available workflow based on dependencies
 */
export function getNextAvailableWorkflow(
  allWorkflows: string[],
  completedWorkflows: Set<string>,
  workflowScores: Map<string, number>
): string | null {
  for (const workflowId of allWorkflows) {
    if (completedWorkflows.has(workflowId)) {
      continue;
    }

    const { canProceed } = canWorkflowProceed(workflowId, completedWorkflows, workflowScores);
    if (canProceed) {
      return workflowId;
    }
  }

  return null;
}

// ============================================================================
// ITERATIVE IMPROVEMENT - İteratif İyileştirme
// ============================================================================

/**
 * Improve content until quality gate passes
 */
export async function improveUntilPass(
  workflowId: string,
  initialContent: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ content: string; passed: boolean; iterations: number; finalScore: number }> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🔄 İTERATİF İYİLEŞTİRME'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const result = await runQualityGate(workflowId, initialContent, adapter, showOutput);

  return {
    content: result.improvedContent,
    passed: result.result.passed,
    iterations: result.result.attempts,
    finalScore: result.result.score,
  };
}

/**
 * Full pipeline: Generate → Review → Fix → Validate
 */
export async function fullGenerateAndValidatePipeline(
  workflowId: string,
  context: ExecutionContext,
  generateFn: () => Promise<string>,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ content: string; passed: boolean; score: number }> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🚀 FULL PIPELINE: Generate → Review → Fix → Validate'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  // Step 1: Generate initial content
  if (showOutput) {
    console.log('\n📝 Step 1: İçerik üretiliyor...');
  }
  let content = await generateFn();

  // Step 2: Run adversarial review and fix
  if (showOutput) {
    console.log('\n⚔️ Step 2: Review & Fix döngüsü...');
  }
  const reviewResult = await reviewAndFixLoop(
    content,
    workflowId.includes('prd') ? 'prd' :
    workflowId.includes('arch') ? 'architecture' :
    workflowId.includes('story') ? 'story' : 'general',
    adapter,
    2,
    showOutput
  );
  content = reviewResult.finalContent;

  // Step 3: Run quality gate
  if (showOutput) {
    console.log('\n🚦 Step 3: Quality gate kontrolü...');
  }
  const gateResult = await runQualityGate(workflowId, content, adapter, showOutput);
  content = gateResult.improvedContent;

  // Step 4: Final validation
  if (showOutput) {
    console.log('\n✅ Step 4: Final validasyon...');
    if (gateResult.result.passed) {
      p.log.success(`Pipeline tamamlandı! Skor: ${gateResult.result.score}/100 (${gateResult.result.grade})`);
    } else {
      p.log.warn(`Pipeline tamamlandı ama skor yetersiz: ${gateResult.result.score}/100`);
    }
  }

  return {
    content,
    passed: gateResult.result.passed,
    score: gateResult.result.score,
  };
}
