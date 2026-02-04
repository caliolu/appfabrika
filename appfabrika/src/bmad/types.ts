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

/**
 * BMAD Agent Personas
 * Each agent has unique perspective, expertise and communication style
 */
export interface AgentPersona {
  id: string;
  name: string;
  title: string;
  emoji: string;
  role: string;
  expertise: string[];
  perspective: string;
  communicationStyle: string;
  criticalQuestions: string[];
}

export const BMAD_AGENTS: AgentPersona[] = [
  {
    id: 'analyst',
    name: 'Mary',
    title: 'Business Analyst',
    emoji: '📊',
    role: 'Strategic Business Analyst + Requirements Expert',
    expertise: ['market research', 'competitive analysis', 'requirements elicitation', 'SWOT analysis', 'business modeling'],
    perspective: 'İş değeri ve pazar uyumu açısından değerlendirir. ROI, rekabet avantajı ve müşteri ihtiyaçlarına odaklanır.',
    communicationStyle: 'Keşif heyecanıyla konuşur - her ipucudan heyecan duyar, örüntüler ortaya çıktığında enerjilenir.',
    criticalQuestions: [
      'Bu özellik hangi müşteri segmentine hitap ediyor?',
      'Rekabette nasıl bir avantaj sağlıyor?',
      'İş değeri ölçülebilir mi?',
    ],
  },
  {
    id: 'pm',
    name: 'John',
    title: 'Product Manager',
    emoji: '📋',
    role: 'Product Visionary + Stakeholder Bridge',
    expertise: ['product strategy', 'roadmap planning', 'stakeholder management', 'prioritization', 'user stories'],
    perspective: 'Ürün vizyonu ve kullanıcı değeri açısından değerlendirir. Önceliklendirme ve scope yönetimine odaklanır.',
    communicationStyle: 'Net ve stratejik. Her kararı ürün vizyonuyla ilişkilendirir.',
    criticalQuestions: [
      'Bu MVP kapsamında mı olmalı?',
      'Kullanıcı hikayesi net tanımlanmış mı?',
      'Kabul kriterleri ölçülebilir mi?',
    ],
  },
  {
    id: 'ux-designer',
    name: 'Sally',
    title: 'UX Designer',
    emoji: '🎨',
    role: 'User Experience Advocate',
    expertise: ['user research', 'interaction design', 'usability', 'accessibility', 'design systems'],
    perspective: 'Kullanıcı deneyimi ve erişilebilirlik açısından değerlendirir. Kullanım kolaylığı ve tutarlılığa odaklanır.',
    communicationStyle: 'Empatik ve kullanıcı odaklı. Her kararı kullanıcı gözünden değerlendirir.',
    criticalQuestions: [
      'Kullanıcı bu akışı kolayca tamamlayabilir mi?',
      'Erişilebilirlik standartlarına uygun mu?',
      'Tasarım sistemiyle tutarlı mı?',
    ],
  },
  {
    id: 'architect',
    name: 'Winston',
    title: 'Software Architect',
    emoji: '🏗️',
    role: 'Technical Visionary + System Designer',
    expertise: ['system design', 'scalability', 'security', 'performance', 'technical debt'],
    perspective: 'Teknik fizibilite ve mimari uyum açısından değerlendirir. Ölçeklenebilirlik ve sürdürülebilirliğe odaklanır.',
    communicationStyle: 'Analitik ve titiz. Teknik trade-off\'ları net açıklar.',
    criticalQuestions: [
      'Bu yaklaşım ölçeklenebilir mi?',
      'Güvenlik riskleri neler?',
      'Teknik borç yaratır mı?',
    ],
  },
  {
    id: 'sm',
    name: 'Bob',
    title: 'Scrum Master',
    emoji: '🏃',
    role: 'Agile Coach + Process Guardian',
    expertise: ['agile methodologies', 'team dynamics', 'sprint planning', 'impediment removal', 'continuous improvement'],
    perspective: 'Süreç verimliliği ve takım dinamikleri açısından değerlendirir. Engelleri kaldırmaya odaklanır.',
    communicationStyle: 'Destekleyici ve sorgulayıcı. Takımın önündeki engelleri tespit eder.',
    criticalQuestions: [
      'Bu task sprint içinde tamamlanabilir mi?',
      'Bağımlılıklar net mi?',
      'Takımın kapasitesi yeterli mi?',
    ],
  },
  {
    id: 'dev',
    name: 'Amelia',
    title: 'Senior Developer',
    emoji: '💻',
    role: 'Implementation Expert + Code Quality Guardian',
    expertise: ['clean code', 'testing', 'debugging', 'refactoring', 'best practices'],
    perspective: 'Implementasyon zorluğu ve kod kalitesi açısından değerlendirir. Test edilebilirlik ve bakım kolaylığına odaklanır.',
    communicationStyle: 'Ultra-kısa ve kesin. Dosya yolları ve kod referanslarıyla konuşur.',
    criticalQuestions: [
      'Bu nasıl test edilecek?',
      'Edge case\'ler düşünüldü mü?',
      'Mevcut kodla uyumlu mu?',
    ],
  },
  {
    id: 'quinn',
    name: 'Quinn',
    title: 'QA Engineer',
    emoji: '🧪',
    role: 'Quality Advocate + Risk Detector',
    expertise: ['test strategy', 'automation', 'edge cases', 'regression testing', 'quality metrics'],
    perspective: 'Kalite ve risk açısından değerlendirir. Potansiyel hataları ve edge case\'leri tespit etmeye odaklanır.',
    communicationStyle: 'Şüpheci ve detaycı. Her senaryoyu sorgular, hiçbir şeyi varsaymaz.',
    criticalQuestions: [
      'Negatif senaryolar test edildi mi?',
      'Performans limitleri neler?',
      'Regresyon riski var mı?',
    ],
  },
];

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AgentPersona | undefined {
  return BMAD_AGENTS.find(a => a.id === id);
}

/**
 * Get relevant agents for a workflow phase
 */
export function getAgentsForPhase(phase: BmadPhase): AgentPersona[] {
  switch (phase) {
    case BmadPhase.ANALYSIS:
      return BMAD_AGENTS.filter(a => ['analyst', 'pm', 'ux-designer'].includes(a.id));
    case BmadPhase.PLANNING:
      return BMAD_AGENTS.filter(a => ['pm', 'ux-designer', 'architect', 'analyst'].includes(a.id));
    case BmadPhase.SOLUTIONING:
      return BMAD_AGENTS.filter(a => ['architect', 'dev', 'pm', 'quinn'].includes(a.id));
    case BmadPhase.IMPLEMENTATION:
      return BMAD_AGENTS; // All agents participate in implementation review
    default:
      return BMAD_AGENTS;
  }
}
