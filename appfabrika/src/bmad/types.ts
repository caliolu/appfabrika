/**
 * BMAD Workflow Types
 * Full BMAD methodology type definitions
 */

/**
 * BMAD Phases
 */
export enum BmadPhase {
  ANALYSIS = 'analysis',
  PLANNING = 'planning',
  SOLUTIONING = 'solutioning',
  IMPLEMENTATION = 'implementation',
}

/**
 * Workflow metadata from frontmatter
 */
export interface WorkflowMeta {
  name: string;
  description: string;
  phase: BmadPhase;
  order: number;
  required: boolean;
  agent?: string;
  command?: string;
  nextStep?: string;
  webBundle?: boolean;
}

/**
 * Step metadata from frontmatter
 */
export interface StepMeta {
  name: string;
  description: string;
  nextStepFile?: string;
  outputFile?: string;
  advancedElicitationTask?: string;
  partyModeWorkflow?: string;
}

/**
 * Step section - a logical section within a step
 */
export interface StepSection {
  number: number;
  title: string;
  content: string;
  questions: string[];
  isMenu: boolean;
}

/**
 * Parsed step file
 */
export interface ParsedStep {
  meta: StepMeta;
  goal: string;
  sections: StepSection[];
  menuOptions: MenuOption[];
  successMetrics: string[];
  failureModes: string[];
}

/**
 * Menu option (A/P/C style)
 */
export interface MenuOption {
  key: string;
  label: string;
  action: 'advanced-elicitation' | 'party-mode' | 'continue' | 'custom';
  nextFile?: string;
}

/**
 * Parsed workflow
 */
export interface ParsedWorkflow {
  meta: WorkflowMeta;
  steps: ParsedStep[];
  template?: string;
  currentStepIndex: number;
}

/**
 * Phase definition with its workflows
 */
export interface PhaseDefinition {
  phase: BmadPhase;
  name: string;
  emoji: string;
  workflows: WorkflowDefinition[];
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  command: string;
  agent: string;
  agentEmoji: string;
  required: boolean;
  description: string;
  stepCount: number;
  path: string;
}

/**
 * Execution state for a workflow
 */
export interface WorkflowState {
  workflowId: string;
  currentStepIndex: number;
  completedSteps: string[];
  outputs: Map<string, string>;
  startedAt: Date;
  lastUpdatedAt: Date;
}

/**
 * Execution context passed between steps
 */
export interface ExecutionContext {
  projectName: string;
  projectPath: string;
  idea: string;
  phase: BmadPhase;
  workflow: ParsedWorkflow;
  state: WorkflowState;
  previousOutputs: Map<string, string>;
  userPreferences: Map<string, string>;
}

/**
 * Step execution result
 */
export interface StepResult {
  success: boolean;
  output: string;
  userApproved: boolean;
  nextStep?: string;
  iterations: number;
}

/**
 * All BMAD phases with their workflows
 */
export const BMAD_PHASES: PhaseDefinition[] = [
  {
    phase: BmadPhase.ANALYSIS,
    name: 'Analiz',
    emoji: '🔍',
    workflows: [
      {
        id: 'brainstorming',
        name: 'Beyin Fırtınası',
        command: '/bmad-brainstorming',
        agent: 'Mary',
        agentEmoji: '📊',
        required: false,
        description: 'Uzman rehberliğinde beyin fırtınası',
        stepCount: 7,
        path: 'core/workflows/brainstorming',
      },
      {
        id: 'market-research',
        name: 'Pazar Araştırması',
        command: '/bmad-bmm-research',
        agent: 'Mary',
        agentEmoji: '📊',
        required: false,
        description: 'Pazar analizi, rekabet, müşteri ihtiyaçları',
        stepCount: 6,
        path: 'bmm/workflows/1-analysis/research',
      },
      {
        id: 'domain-research',
        name: 'Alan Araştırması',
        command: '/bmad-bmm-research',
        agent: 'Mary',
        agentEmoji: '📊',
        required: false,
        description: 'Sektör derinlemesine inceleme',
        stepCount: 6,
        path: 'bmm/workflows/1-analysis/research',
      },
      {
        id: 'technical-research',
        name: 'Teknik Araştırma',
        command: '/bmad-bmm-research',
        agent: 'Mary',
        agentEmoji: '📊',
        required: false,
        description: 'Teknik fizibilite, mimari seçenekler',
        stepCount: 6,
        path: 'bmm/workflows/1-analysis/research',
      },
      {
        id: 'create-product-brief',
        name: 'Ürün Özeti Oluştur',
        command: '/bmad-bmm-create-product-brief',
        agent: 'Mary',
        agentEmoji: '📊',
        required: true,
        description: 'Ürün fikrini netleştirme',
        stepCount: 6,
        path: 'bmm/workflows/1-analysis/create-product-brief',
      },
    ],
  },
  {
    phase: BmadPhase.PLANNING,
    name: 'Planlama',
    emoji: '📋',
    workflows: [
      {
        id: 'create-prd',
        name: 'PRD Oluştur',
        command: '/bmad-bmm-create-prd',
        agent: 'John',
        agentEmoji: '📋',
        required: true,
        description: 'Ürün gereksinim dokümanı',
        stepCount: 12,
        path: 'bmm/workflows/2-plan-workflows/create-prd',
      },
      {
        id: 'create-ux-design',
        name: 'UX Tasarımı',
        command: '/bmad-bmm-create-ux-design',
        agent: 'Sally',
        agentEmoji: '🎨',
        required: false,
        description: 'UX tasarım planı',
        stepCount: 14,
        path: 'bmm/workflows/2-plan-workflows/create-ux-design',
      },
    ],
  },
  {
    phase: BmadPhase.SOLUTIONING,
    name: 'Çözümleme',
    emoji: '🏗️',
    workflows: [
      {
        id: 'create-architecture',
        name: 'Mimari Oluştur',
        command: '/bmad-bmm-create-architecture',
        agent: 'Winston',
        agentEmoji: '🏗️',
        required: true,
        description: 'Teknik mimari kararlar',
        stepCount: 8,
        path: 'bmm/workflows/3-solutioning/create-architecture',
      },
      {
        id: 'create-epics-stories',
        name: 'Epic & Story Oluştur',
        command: '/bmad-bmm-create-epics-and-stories',
        agent: 'John',
        agentEmoji: '📋',
        required: true,
        description: 'Epik ve hikaye listesi',
        stepCount: 4,
        path: 'bmm/workflows/3-solutioning/create-epics-and-stories',
      },
      {
        id: 'check-implementation-readiness',
        name: 'Uygulama Hazırlığı Kontrolü',
        command: '/bmad-bmm-check-implementation-readiness',
        agent: 'Winston',
        agentEmoji: '🏗️',
        required: true,
        description: 'PRD, UX, Mimari uyum kontrolü',
        stepCount: 6,
        path: 'bmm/workflows/3-solutioning/check-implementation-readiness',
      },
    ],
  },
  {
    phase: BmadPhase.IMPLEMENTATION,
    name: 'Uygulama',
    emoji: '💻',
    workflows: [
      {
        id: 'sprint-planning',
        name: 'Sprint Planlama',
        command: '/bmad-bmm-sprint-planning',
        agent: 'Bob',
        agentEmoji: '🏃',
        required: true,
        description: 'Sprint planı oluşturma',
        stepCount: 3,
        path: 'bmm/workflows/4-implementation/sprint-planning',
      },
      {
        id: 'create-story',
        name: 'Story Oluştur',
        command: '/bmad-bmm-create-story',
        agent: 'Bob',
        agentEmoji: '🏃',
        required: true,
        description: 'Hikaye hazırlama',
        stepCount: 3,
        path: 'bmm/workflows/4-implementation/create-story',
      },
      {
        id: 'dev-story',
        name: 'Story Geliştir',
        command: '/bmad-bmm-dev-story',
        agent: 'Amelia',
        agentEmoji: '💻',
        required: true,
        description: 'Hikaye implementasyonu',
        stepCount: 3,
        path: 'bmm/workflows/4-implementation/dev-story',
      },
      {
        id: 'code-review',
        name: 'Kod İnceleme',
        command: '/bmad-bmm-code-review',
        agent: 'Amelia',
        agentEmoji: '💻',
        required: true,
        description: 'Adversarial kod inceleme - her story sonrası',
        stepCount: 3,
        path: 'bmm/workflows/4-implementation/code-review',
      },
      {
        id: 'qa-automate',
        name: 'QA Otomasyonu',
        command: '/bmad-bmm-qa-automate',
        agent: 'Quinn',
        agentEmoji: '🧪',
        required: true,
        description: 'Otomatik test oluşturma - her story sonrası',
        stepCount: 3,
        path: 'bmm/workflows/qa/automate',
      },
      {
        id: 'retrospective',
        name: 'Retrospektif',
        command: '/bmad-bmm-retrospective',
        agent: 'Bob',
        agentEmoji: '🏃',
        required: true,
        description: 'Epic sonu değerlendirme ve öğrenimler',
        stepCount: 2,
        path: 'bmm/workflows/4-implementation/retrospective',
      },
      {
        id: 'correct-course',
        name: 'Rota Düzeltme',
        command: '/bmad-bmm-correct-course',
        agent: 'Bob',
        agentEmoji: '🔄',
        required: false,
        description: 'Sprint sırasında değişiklik yönetimi',
        stepCount: 3,
        path: 'bmm/workflows/4-implementation/correct-course',
      },
      {
        id: 'sprint-status',
        name: 'Sprint Durumu',
        command: '/bmad-bmm-sprint-status',
        agent: 'Bob',
        agentEmoji: '📊',
        required: false,
        description: 'Sprint ilerleme takibi',
        stepCount: 2,
        path: 'bmm/workflows/4-implementation/sprint-status',
      },
    ],
  },
];

/**
 * Get total step count across all workflows
 */
export function getTotalStepCount(): number {
  return BMAD_PHASES.reduce(
    (total, phase) =>
      total + phase.workflows.reduce((wTotal, w) => wTotal + w.stepCount, 0),
    0
  );
}

/**
 * Get all required workflows
 */
export function getRequiredWorkflows(): WorkflowDefinition[] {
  return BMAD_PHASES.flatMap((phase) =>
    phase.workflows.filter((w) => w.required)
  );
}
