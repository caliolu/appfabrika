/**
 * BMAD Advanced Features
 * Party Mode, Excalidraw Diagrams, Document Project
 */

import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import type { ExecutionContext, AgentPersona } from './types.js';
import { BMAD_AGENTS } from './types.js';

/**
 * Stream AI response to console
 */
async function streamResponse(
  adapter: AnthropicAdapter,
  prompt: string,
  systemPrompt: string,
  showOutput: boolean = true
): Promise<string> {
  let fullContent = '';

  if (showOutput) {
    console.log('');
  }

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

// ============================================================================
// PARTY MODE - Multi-Agent Discussion
// ============================================================================

export interface PartyModeConfig {
  topic: string;
  context: ExecutionContext;
  rounds?: number;
  agents?: string[];
}

export interface PartyModeResult {
  discussion: string;
  consensus: string[];
  actionItems: string[];
  openQuestions: string[];
}

/**
 * Run Party Mode - orchestrate multi-agent discussion
 */
export async function runPartyMode(
  config: PartyModeConfig,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<PartyModeResult> {
  const rounds = config.rounds || 3;
  const selectedAgents = config.agents
    ? BMAD_AGENTS.filter(a => config.agents!.includes(a.id))
    : BMAD_AGENTS;

  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🎉 PARTY MODE ACTIVATED!'.padEnd(59) + '║');
    console.log('║ ' + `${selectedAgents.length} uzman tartışmaya katılıyor`.padEnd(57) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('');
    console.log('👥 Katılımcılar:');
    selectedAgents.forEach(a => console.log(`   ${a.emoji} ${a.name} - ${a.title}`));
    console.log('');
    console.log(`📋 Konu: ${config.topic}`);
    console.log('═'.repeat(60));
  }

  let fullDiscussion = '';
  const allPoints: string[] = [];

  // Run discussion rounds
  for (let round = 1; round <= rounds; round++) {
    if (showOutput) {
      console.log('');
      console.log(`┌─────────────────────────────────────────────────────────┐`);
      console.log(`│ 🔄 ROUND ${round}/${rounds}`.padEnd(58) + '│');
      console.log(`└─────────────────────────────────────────────────────────┘`);
    }

    // Each agent contributes in this round
    for (const agent of selectedAgents) {
      if (showOutput) {
        console.log('');
        console.log(`${agent.emoji} ${agent.name} (${agent.title}):`);
        console.log('─'.repeat(50));
      }

      const previousContext = fullDiscussion.slice(-3000);

      const systemPrompt = `Sen ${agent.name}, bir ${agent.title}'sın.
Rol: ${agent.role}
Uzmanlık: ${agent.expertise.join(', ')}
İletişim tarzı: ${agent.communicationStyle}

Bu bir grup tartışmasısın. Diğer uzmanların görüşlerini dikkate al,
kendi perspektifinden katkı sağla. Gerekirse diğer uzmanlarla hemfikir ol
veya nazikçe karşı çık.

Round ${round}/${rounds} - ${round === 1 ? 'İlk görüşlerini paylaş' : round === rounds ? 'Son değerlendirmeni yap' : 'Önceki yorumlara cevap ver ve geliştir'}

Türkçe konuş. Kısa ve öz ol (max 100 kelime).`;

      const prompt = `Proje: "${config.context.idea}"
Tartışma Konusu: ${config.topic}

${previousContext ? `Önceki Tartışma:\n${previousContext}\n\n---\n\n` : ''}

${agent.name} olarak bu konuda görüşünü paylaş.
${round > 1 ? 'Diğer uzmanların söylediklerine de değin.' : ''}`;

      const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);
      fullDiscussion += `\n\n### ${agent.emoji} ${agent.name} (Round ${round})\n${response}`;
      allPoints.push(`${agent.name}: ${response.slice(0, 200)}`);
    }

    // Inter-agent interaction in later rounds
    if (round < rounds && showOutput) {
      console.log('');
      console.log('💬 Uzmanlar arası etkileşim...');
    }
  }

  // Final synthesis
  if (showOutput) {
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📊 TARTIŞMA SENTEZİ');
    console.log('════════════════════════════════════════════════════════════');
  }

  const synthesisPrompt = `${selectedAgents.length} uzmanın ${rounds} tur boyunca yaptığı tartışmayı özetle:

${fullDiscussion}

---

## Sentez Raporu:

### ✅ Konsensüs Noktaları
(Tüm uzmanların hemfikir olduğu konular)

### ⚔️ Tartışmalı Konular
(Farklı görüşlerin olduğu alanlar)

### 💡 Öne Çıkan Fikirler
(En değerli öneriler)

### 📋 Aksiyon Maddeleri
(Somut adımlar)

### ❓ Açık Sorular
(Cevap bekleyen konular)

Türkçe ve öz yaz.`;

  const synthesis = await streamResponse(
    adapter,
    synthesisPrompt,
    'Sen deneyimli bir moderatörsün. Uzman tartışmasını sentezle.',
    showOutput
  );

  // Parse results
  const consensusMatch = synthesis.match(/### ✅ Konsensüs[^#]*?(?=###|$)/s);
  const actionMatch = synthesis.match(/### 📋 Aksiyon[^#]*?(?=###|$)/s);
  const questionsMatch = synthesis.match(/### ❓ Açık[^#]*?(?=###|$)/s);

  return {
    discussion: fullDiscussion + '\n\n---\n\n# SENTEZ\n\n' + synthesis,
    consensus: consensusMatch ? consensusMatch[0].split('\n').filter(l => l.startsWith('-')).map(l => l.slice(2)) : [],
    actionItems: actionMatch ? actionMatch[0].split('\n').filter(l => l.startsWith('-')).map(l => l.slice(2)) : [],
    openQuestions: questionsMatch ? questionsMatch[0].split('\n').filter(l => l.startsWith('-')).map(l => l.slice(2)) : [],
  };
}

// ============================================================================
// EXCALIDRAW DIAGRAMS - Visual Generation
// ============================================================================

export type DiagramType = 'flowchart' | 'architecture' | 'wireframe' | 'dataflow' | 'erd';

export interface DiagramConfig {
  type: DiagramType;
  title: string;
  description: string;
  context: ExecutionContext;
}

export interface ExcalidrawElement {
  id: string;
  type: 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'text' | 'line';
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  roundness?: number;
  points?: [number, number][];
  startBinding?: { elementId: string };
  endBinding?: { elementId: string };
}

export interface ExcalidrawDiagram {
  type: 'excalidraw';
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: string;
    gridSize: number;
  };
}

/**
 * Generate Excalidraw diagram
 */
export async function generateDiagram(
  config: DiagramConfig,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ json: ExcalidrawDiagram; markdown: string }> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log(`║ 📊 ${config.type.toUpperCase()} DİYAGRAMI OLUŞTURULUYOR`.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const typePrompts: Record<DiagramType, string> = {
    flowchart: `Bir flowchart (akış diyagramı) oluştur:
- Başlangıç ve bitiş noktaları (ellipse)
- İşlem adımları (rectangle)
- Karar noktaları (diamond)
- Bağlantı okları (arrow)
- Her eleman için açıklayıcı label`,

    architecture: `Bir mimari diyagram oluştur:
- Servisler/Komponentler (rectangle)
- Veritabanları (rectangle, farklı renk)
- Dış sistemler (rectangle, kesikli çizgi)
- Bağlantılar ve data flow okları
- Layer'ları görsel olarak grupla`,

    wireframe: `Bir UI wireframe oluştur:
- Sayfa container'ı
- Header, navigation
- İçerik alanları
- Butonlar ve input alanları
- Placeholder text'ler`,

    dataflow: `Bir data flow diyagramı oluştur:
- Veri kaynakları
- İşlem süreçleri (ellipse)
- Veri depoları (rectangle)
- Data flow okları ve label'ları`,

    erd: `Bir Entity Relationship diyagramı oluştur:
- Entity'ler (rectangle)
- Attribute'lar
- İlişkiler (1:1, 1:N, N:M)
- Foreign key bağlantıları`,
  };

  const systemPrompt = `Sen bir teknik diyagram uzmanısın. Excalidraw formatında diyagram oluşturuyorsun.

Excalidraw element formatı:
{
  "id": "unique-id",
  "type": "rectangle|ellipse|diamond|arrow|text",
  "x": number,
  "y": number,
  "width": number,
  "height": number,
  "label": "text",
  "strokeColor": "#000000",
  "backgroundColor": "#ffffff",
  "strokeWidth": 2
}

Arrow için:
{
  "type": "arrow",
  "points": [[0, 0], [100, 0]],
  "startBinding": {"elementId": "source-id"},
  "endBinding": {"elementId": "target-id"}
}`;

  const prompt = `Proje: "${config.context.idea}"
Diyagram Başlığı: ${config.title}
Açıklama: ${config.description}

${typePrompts[config.type]}

---

Lütfen iki çıktı üret:

1. **JSON** - Excalidraw formatında elements array (json kod bloğunda)
2. **Markdown** - Diyagramın text açıklaması

JSON'da en az 5-10 element olsun ve mantıklı yerleştirilsin.
Koordinatlar: x: 0-800, y: 0-600 arasında olsun.`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  // Parse JSON from response
  const jsonPattern = /`{3}json\n([\s\S]*?)\n`{3}/;
  const jsonMatch = response.match(jsonPattern);
  let elements: ExcalidrawElement[] = [];

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      elements = Array.isArray(parsed) ? parsed : parsed.elements || [];
    } catch {
      // Generate default elements if parsing fails
      elements = generateDefaultElements(config.type, config.title);
    }
  } else {
    elements = generateDefaultElements(config.type, config.title);
  }

  const diagram: ExcalidrawDiagram = {
    type: 'excalidraw',
    version: 2,
    source: 'appfabrika-bmad',
    elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: 20,
    },
  };

  // Extract markdown description
  const codeBlockMarker = '`'.repeat(3) + 'json';
  const markdownParts = response.split(codeBlockMarker);
  const markdown = markdownParts[0] + (markdownParts[2] || '');

  if (showOutput) {
    console.log('');
    console.log(`✅ Diyagram oluşturuldu: ${elements.length} element`);
  }

  return { json: diagram, markdown: markdown.trim() };
}

/**
 * Generate default elements for a diagram type
 */
function generateDefaultElements(type: DiagramType, title: string): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];
  let id = 1;

  // Title
  elements.push({
    id: `text-${id++}`,
    type: 'text',
    x: 300,
    y: 20,
    label: title,
  });

  switch (type) {
    case 'flowchart':
      elements.push(
        { id: `el-${id++}`, type: 'ellipse', x: 350, y: 80, width: 100, height: 50, label: 'Start', backgroundColor: '#a5d8ff' },
        { id: `el-${id++}`, type: 'rectangle', x: 325, y: 180, width: 150, height: 60, label: 'Process 1' },
        { id: `el-${id++}`, type: 'diamond', x: 325, y: 290, width: 150, height: 80, label: 'Decision?' },
        { id: `el-${id++}`, type: 'rectangle', x: 150, y: 420, width: 150, height: 60, label: 'Process A' },
        { id: `el-${id++}`, type: 'rectangle', x: 500, y: 420, width: 150, height: 60, label: 'Process B' },
        { id: `el-${id++}`, type: 'ellipse', x: 350, y: 530, width: 100, height: 50, label: 'End', backgroundColor: '#ffc9c9' },
      );
      break;

    case 'architecture':
      elements.push(
        { id: `el-${id++}`, type: 'rectangle', x: 300, y: 80, width: 200, height: 60, label: 'Frontend', backgroundColor: '#a5d8ff' },
        { id: `el-${id++}`, type: 'rectangle', x: 300, y: 200, width: 200, height: 60, label: 'API Gateway', backgroundColor: '#b2f2bb' },
        { id: `el-${id++}`, type: 'rectangle', x: 100, y: 320, width: 150, height: 60, label: 'Auth Service' },
        { id: `el-${id++}`, type: 'rectangle', x: 325, y: 320, width: 150, height: 60, label: 'Core Service' },
        { id: `el-${id++}`, type: 'rectangle', x: 550, y: 320, width: 150, height: 60, label: 'Data Service' },
        { id: `el-${id++}`, type: 'rectangle', x: 325, y: 440, width: 150, height: 60, label: 'Database', backgroundColor: '#ffec99' },
      );
      break;

    case 'wireframe':
      elements.push(
        { id: `el-${id++}`, type: 'rectangle', x: 100, y: 80, width: 600, height: 500, label: '', strokeWidth: 2 },
        { id: `el-${id++}`, type: 'rectangle', x: 100, y: 80, width: 600, height: 60, label: 'Header', backgroundColor: '#e9ecef' },
        { id: `el-${id++}`, type: 'rectangle', x: 100, y: 140, width: 150, height: 440, label: 'Sidebar', backgroundColor: '#f8f9fa' },
        { id: `el-${id++}`, type: 'rectangle', x: 270, y: 160, width: 400, height: 200, label: 'Main Content' },
        { id: `el-${id++}`, type: 'rectangle', x: 270, y: 380, width: 120, height: 40, label: 'Button', backgroundColor: '#a5d8ff', roundness: 4 },
      );
      break;

    case 'dataflow':
      elements.push(
        { id: `el-${id++}`, type: 'rectangle', x: 100, y: 200, width: 120, height: 60, label: 'User', strokeWidth: 3 },
        { id: `el-${id++}`, type: 'ellipse', x: 320, y: 100, width: 140, height: 70, label: 'Process 1' },
        { id: `el-${id++}`, type: 'ellipse', x: 320, y: 300, width: 140, height: 70, label: 'Process 2' },
        { id: `el-${id++}`, type: 'rectangle', x: 560, y: 200, width: 120, height: 60, label: 'Data Store' },
      );
      break;

    case 'erd':
      elements.push(
        { id: `el-${id++}`, type: 'rectangle', x: 100, y: 150, width: 180, height: 150, label: 'User\n─────\nid: PK\nname\nemail', backgroundColor: '#a5d8ff' },
        { id: `el-${id++}`, type: 'rectangle', x: 400, y: 150, width: 180, height: 150, label: 'Order\n─────\nid: PK\nuser_id: FK\ntotal', backgroundColor: '#b2f2bb' },
        { id: `el-${id++}`, type: 'rectangle', x: 400, y: 380, width: 180, height: 150, label: 'Product\n─────\nid: PK\nname\nprice', backgroundColor: '#ffec99' },
      );
      break;
  }

  return elements;
}

/**
 * Generate all diagrams for a project
 */
export async function generateAllDiagrams(
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<Map<DiagramType, { json: ExcalidrawDiagram; markdown: string }>> {
  const diagrams = new Map<DiagramType, { json: ExcalidrawDiagram; markdown: string }>();

  const diagramConfigs: DiagramConfig[] = [
    {
      type: 'architecture',
      title: `${context.projectName} - Sistem Mimarisi`,
      description: 'Sistemin genel mimarisi, servisler ve bağlantıları',
      context,
    },
    {
      type: 'flowchart',
      title: `${context.projectName} - Ana Akış`,
      description: 'Kullanıcı akışı ve temel iş süreçleri',
      context,
    },
    {
      type: 'dataflow',
      title: `${context.projectName} - Veri Akışı`,
      description: 'Veri kaynakları, işlemler ve depolama',
      context,
    },
    {
      type: 'erd',
      title: `${context.projectName} - Veritabanı Şeması`,
      description: 'Entity ilişkileri ve veri modeli',
      context,
    },
  ];

  for (const config of diagramConfigs) {
    const result = await generateDiagram(config, adapter, showOutput);
    diagrams.set(config.type, result);
  }

  return diagrams;
}

// ============================================================================
// DOCUMENT PROJECT - Existing Codebase Analysis
// ============================================================================

export interface ProjectAnalysis {
  overview: string;
  architecture: string;
  technologies: string[];
  patterns: string[];
  structure: string;
  recommendations: string[];
}

/**
 * Analyze and document an existing project
 */
export async function documentProject(
  projectPath: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<ProjectAnalysis> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 📚 PROJE DOKÜMANTASYONU'.padEnd(59) + '║');
    console.log('║ ' + `Analiz ediliyor: ${projectPath.slice(-40)}`.padEnd(57) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  // This would normally scan the filesystem - for now, generate analysis
  const systemPrompt = `Sen deneyimli bir yazılım mimarısın. Projeleri analiz edip dokümante edersin.
Kapsamlı ve yapılandırılmış dokümantasyon üret.`;

  const prompt = `Proje yolu: ${projectPath}

Bu projeyi analiz et ve şu başlıklarda dokümante et:

## 1. Proje Genel Bakış
- Projenin amacı
- Temel özellikler
- Hedef kullanıcılar

## 2. Mimari Analiz
- Kullanılan mimari pattern
- Katman yapısı
- Servis/modül organizasyonu

## 3. Teknoloji Yığını
- Programlama dili(leri)
- Framework'ler
- Veritabanı
- Dış servisler

## 4. Kod Pattern'leri
- Design pattern'lar
- Best practice'ler
- Anti-pattern'ler (varsa)

## 5. Dizin Yapısı
- Ana klasörler ve amaçları
- Önemli dosyalar

## 6. İyileştirme Önerileri
- Potansiyel iyileştirmeler
- Teknik borç alanları
- Öncelikli aksiyonlar

Türkçe ve detaylı yaz.`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  // Parse sections
  const sections = {
    overview: extractSection(response, '## 1. Proje Genel Bakış', '## 2.'),
    architecture: extractSection(response, '## 2. Mimari Analiz', '## 3.'),
    technologies: extractListItems(extractSection(response, '## 3. Teknoloji Yığını', '## 4.')),
    patterns: extractListItems(extractSection(response, '## 4. Kod Pattern', '## 5.')),
    structure: extractSection(response, '## 5. Dizin Yapısı', '## 6.'),
    recommendations: extractListItems(extractSection(response, '## 6. İyileştirme Önerileri', '')),
  };

  if (showOutput) {
    console.log('');
    console.log(`✅ Proje analizi tamamlandı`);
    console.log(`   📊 ${sections.technologies.length} teknoloji tespit edildi`);
    console.log(`   🔧 ${sections.patterns.length} pattern belirlendi`);
    console.log(`   💡 ${sections.recommendations.length} öneri oluşturuldu`);
  }

  return sections;
}

/**
 * Extract section from markdown
 */
function extractSection(content: string, startMarker: string, endMarker: string): string {
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return '';

  const afterStart = content.slice(startIdx + startMarker.length);
  const endIdx = endMarker ? afterStart.indexOf(endMarker) : afterStart.length;

  return (endIdx === -1 ? afterStart : afterStart.slice(0, endIdx)).trim();
}

/**
 * Extract list items from section
 */
function extractListItems(section: string): string[] {
  const items = section.match(/^[-*]\s+(.+)$/gm);
  return items ? items.map(item => item.replace(/^[-*]\s+/, '').trim()) : [];
}

// ============================================================================
// WORKFLOW INTEGRATION - Add features to workflow execution
// ============================================================================

/**
 * Run party mode discussion on a specific topic from workflow
 */
export async function runWorkflowPartyMode(
  topic: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  const result = await runPartyMode(
    { topic, context, rounds: 2 },
    adapter,
    showOutput
  );

  return result.discussion;
}

/**
 * Generate diagrams for current workflow phase
 */
export async function generatePhaseDiagrams(
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  const diagrams = await generateAllDiagrams(context, adapter, showOutput);

  let output = '# 📊 OLUŞTURULAN DİYAGRAMLAR\n\n';

  for (const [type, { markdown }] of diagrams) {
    output += `## ${type.toUpperCase()}\n\n${markdown}\n\n---\n\n`;
  }

  return output;
}
