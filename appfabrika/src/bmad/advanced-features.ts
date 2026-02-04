/**
 * BMAD Advanced Features
 * Code Generation, Validation, Reviews, Quick Flows, Doc Tools
 */

import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import type { ExecutionContext, BmadPhase } from './types.js';
import { BMAD_AGENTS } from './types.js';

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

// ============================================================================
// 1. CODE GENERATION - Otomatik Kod Üretimi
// ============================================================================

export interface CodeGenerationConfig {
  projectName: string;
  architecture: string;
  techStack: string[];
  features: string[];
  outputPath: string;
}

export interface GeneratedCode {
  files: { path: string; content: string; description: string }[];
  instructions: string;
}

/**
 * Generate project scaffolding from architecture
 */
export async function generateProjectScaffolding(
  config: CodeGenerationConfig,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<GeneratedCode> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🏗️ KOD SCAFFOLDING OLUŞTURULUYOR'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const systemPrompt = `Sen deneyimli bir full-stack developer'sın.
Verilen mimari ve teknoloji yığınına göre proje scaffolding'i oluşturuyorsun.
Clean code, SOLID prensipleri ve best practice'lere uygun kod üret.
Her dosya için path, content ve description üret.`;

  const prompt = `Proje: ${config.projectName}
Mimari: ${config.architecture}
Teknoloji Yığını: ${config.techStack.join(', ')}
Özellikler: ${config.features.join(', ')}

Aşağıdaki dosyaları oluştur:

1. **Proje Yapısı**
   - README.md
   - package.json / requirements.txt / go.mod (teknolojiye göre)
   - .gitignore
   - .env.example

2. **Konfigürasyon**
   - tsconfig.json / eslint config / prettier config
   - Docker dosyaları (Dockerfile, docker-compose.yml)
   - CI/CD config (.github/workflows)

3. **Kaynak Kod Yapısı**
   - src/index.ts (veya main entry point)
   - src/config/ (konfigürasyon)
   - src/routes/ veya src/controllers/ (API endpoints)
   - src/services/ (iş mantığı)
   - src/models/ (veri modelleri)
   - src/utils/ (yardımcı fonksiyonlar)
   - src/types/ (tip tanımları)

4. **Test Yapısı**
   - tests/setup.ts
   - tests/unit/
   - tests/integration/

Her dosya için JSON formatında çıktı ver:
{
  "files": [
    {"path": "dosya/yolu", "content": "dosya içeriği", "description": "açıklama"}
  ],
  "instructions": "Kurulum ve çalıştırma talimatları"
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  // Parse JSON from response
  try {
    const jsonMatch = response.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default structure if parsing fails
  }

  return {
    files: [
      { path: 'README.md', content: `# ${config.projectName}\n\n${config.architecture}`, description: 'Proje dokümantasyonu' },
      { path: 'src/index.ts', content: '// Entry point\nconsole.log("Hello World");', description: 'Ana giriş noktası' },
    ],
    instructions: 'npm install && npm run dev',
  };
}

/**
 * Generate API endpoints from architecture
 */
export async function generateAPIEndpoints(
  entities: string[],
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('🔌 API Endpoint\'leri oluşturuluyor...');
  }

  const systemPrompt = `Sen bir API tasarım uzmanısın.
RESTful API endpoint'leri oluştur.
OpenAPI/Swagger formatında dokümante et.`;

  const prompt = `Proje: ${context.idea}
Entity'ler: ${entities.join(', ')}

Her entity için CRUD endpoint'leri oluştur:
- GET /api/{entity} - Liste
- GET /api/{entity}/:id - Detay
- POST /api/{entity} - Oluştur
- PUT /api/{entity}/:id - Güncelle
- DELETE /api/{entity}/:id - Sil

Ayrıca:
- Authentication endpoint'leri
- İlişkili endpoint'ler
- Pagination, filtering, sorting

TypeScript/Express formatında controller kodu üret.`;

  return await streamResponse(adapter, prompt, systemPrompt, showOutput);
}

/**
 * Generate database models from ERD
 */
export async function generateDatabaseModels(
  entities: { name: string; fields: string[] }[],
  dbType: 'postgresql' | 'mongodb' | 'mysql',
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('🗄️ Veritabanı modelleri oluşturuluyor...');
  }

  const systemPrompt = `Sen bir veritabanı tasarım uzmanısın.
${dbType} için optimum model yapısı oluştur.
İlişkileri, index'leri ve constraint'leri tanımla.`;

  const entitiesStr = entities.map(e => `${e.name}: ${e.fields.join(', ')}`).join('\n');

  const prompt = `Entity'ler:
${entitiesStr}

${dbType === 'mongodb' ? 'Mongoose schema' : dbType === 'postgresql' ? 'Prisma schema' : 'TypeORM entity'} formatında model kodu üret.

Her model için:
- Tüm field tanımları
- İlişkiler (1:1, 1:N, N:M)
- Index'ler
- Validasyon kuralları
- Timestamp'ler (createdAt, updatedAt)`;

  return await streamResponse(adapter, prompt, systemPrompt, showOutput);
}

/**
 * Generate test files from features
 */
export async function generateTestFiles(
  features: string[],
  testType: 'unit' | 'integration' | 'e2e',
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log(`🧪 ${testType.toUpperCase()} testleri oluşturuluyor...`);
  }

  const systemPrompt = `Sen bir test mühendisisin.
${testType} testleri için kapsamlı test senaryoları oluştur.
Jest/Vitest formatında test kodu yaz.`;

  const prompt = `Özellikler: ${features.join(', ')}

Her özellik için ${testType} testleri oluştur:

${testType === 'unit' ? `
- Fonksiyon bazlı testler
- Edge case'ler
- Error handling
- Mock'lar` : testType === 'integration' ? `
- API endpoint testleri
- Veritabanı işlemleri
- Servis entegrasyonları` : `
- Kullanıcı akışları
- Kritik yollar
- Cross-browser testler`}

Her test için:
- describe bloğu
- it/test fonksiyonları
- expect assertions
- Setup/teardown`;

  return await streamResponse(adapter, prompt, systemPrompt, showOutput);
}

// ============================================================================
// 2. VALIDATION & QUALITY SCORES - Validasyon & Kalite Skorları
// ============================================================================

export interface QualityScore {
  overall: number;
  categories: {
    name: string;
    score: number;
    maxScore: number;
    issues: string[];
    suggestions: string[];
  }[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
}

/**
 * Calculate PRD quality score
 */
export async function calculatePRDQuality(
  prdContent: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<QualityScore> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 📋 PRD KALİTE ANALİZİ'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const systemPrompt = `Sen bir PRD kalite uzmanısın.
PRD'yi detaylı analiz edip 0-100 arası puan ver.
Her kategori için issues ve suggestions belirle.`;

  const prompt = `PRD İçeriği:
${prdContent.slice(0, 5000)}

Aşağıdaki kategorilerde değerlendir (her biri 0-20 puan):

1. **Completeness (Tamlık)** - Tüm bölümler mevcut mu?
   - Problem tanımı
   - Hedef kullanıcılar
   - Fonksiyonel gereksinimler
   - Non-fonksiyonel gereksinimler
   - Başarı metrikleri

2. **Clarity (Netlik)** - Gereksinimler açık ve anlaşılır mı?
   - Belirsiz ifadeler var mı?
   - Teknik jargon açıklanmış mı?
   - Örnekler verilmiş mi?

3. **Measurability (Ölçülebilirlik)** - Gereksinimler ölçülebilir mi?
   - Kabul kriterleri tanımlı mı?
   - Sayısal hedefler var mı?
   - Test edilebilir mi?

4. **Consistency (Tutarlılık)** - İç tutarlılık var mı?
   - Çelişen gereksinimler var mı?
   - Terminoloji tutarlı mı?
   - Öncelikler mantıklı mı?

5. **Feasibility (Fizibilite)** - Teknik olarak uygulanabilir mi?
   - Gerçekçi mi?
   - Kaynak gereksinimleri belirtilmiş mi?
   - Risk analizi yapılmış mı?

JSON formatında yanıt ver:
{
  "overall": 85,
  "categories": [
    {"name": "Completeness", "score": 18, "maxScore": 20, "issues": ["..."], "suggestions": ["..."]}
  ],
  "grade": "B",
  "summary": "..."
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"overall"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default score
  }

  return {
    overall: 70,
    categories: [],
    grade: 'C',
    summary: 'Değerlendirme tamamlanamadı',
  };
}

/**
 * Calculate Architecture quality score
 */
export async function calculateArchitectureQuality(
  archContent: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<QualityScore> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🏗️ MİMARİ KALİTE ANALİZİ'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const systemPrompt = `Sen bir yazılım mimari uzmanısın.
Mimari dokümanı detaylı analiz edip 0-100 arası puan ver.`;

  const prompt = `Mimari Doküman:
${archContent.slice(0, 5000)}

Aşağıdaki kategorilerde değerlendir (her biri 0-20 puan):

1. **Scalability** - Ölçeklenebilirlik
2. **Security** - Güvenlik
3. **Maintainability** - Bakım kolaylığı
4. **Performance** - Performans
5. **Modularity** - Modülerlik

JSON formatında yanıt ver.`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"overall"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  return { overall: 70, categories: [], grade: 'C', summary: 'Değerlendirme tamamlanamadı' };
}

/**
 * Calculate Story INVEST score
 */
export async function calculateStoryINVESTScore(
  storyContent: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<QualityScore> {
  if (showOutput) {
    console.log('');
    console.log('📝 Story INVEST Skoru hesaplanıyor...');
  }

  const systemPrompt = `Sen bir Agile koçsun.
User story'yi INVEST kriterlerine göre değerlendir.`;

  const prompt = `User Story:
${storyContent}

INVEST kriterlerine göre değerlendir (her biri 0-16.67 puan):

1. **Independent** - Bağımsız mı?
2. **Negotiable** - Müzakere edilebilir mi?
3. **Valuable** - Değer katıyor mu?
4. **Estimable** - Tahmin edilebilir mi?
5. **Small** - Yeterince küçük mü?
6. **Testable** - Test edilebilir mi?

JSON formatında yanıt ver.`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"overall"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  return { overall: 70, categories: [], grade: 'C', summary: 'Değerlendirme tamamlanamadı' };
}

/**
 * Security risk analysis
 */
export async function analyzeSecurityRisks(
  archContent: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ risks: { severity: 'high' | 'medium' | 'low'; description: string; mitigation: string }[]; score: number }> {
  if (showOutput) {
    console.log('');
    console.log('🔒 Güvenlik risk analizi yapılıyor...');
  }

  const systemPrompt = `Sen bir güvenlik uzmanısın.
OWASP Top 10 ve güvenlik best practice'lerine göre analiz yap.`;

  const prompt = `Mimari/Kod:
${archContent.slice(0, 4000)}

Güvenlik risklerini analiz et:
- Authentication/Authorization
- Data protection
- Input validation
- API security
- Infrastructure security

JSON formatında yanıt ver:
{
  "risks": [{"severity": "high", "description": "...", "mitigation": "..."}],
  "score": 75
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"risks"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  return { risks: [], score: 70 };
}

// ============================================================================
// 3. ADVERSARIAL REVIEW - Agresif Eleştiri Modu
// ============================================================================

export interface AdversarialFinding {
  severity: 'critical' | 'major' | 'minor';
  category: string;
  finding: string;
  impact: string;
  recommendation: string;
}

/**
 * Run adversarial review on any content
 */
export async function runAdversarialReview(
  content: string,
  contentType: 'prd' | 'architecture' | 'code' | 'story' | 'general',
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ findings: AdversarialFinding[]; passedReview: boolean }> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ ⚔️ ADVERSARIAL REVIEW'.padEnd(59) + '║');
    console.log('║ ' + 'Agresif eleştiri modu - her şeyi sorgula'.padEnd(57) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const systemPrompt = `Sen acımasız bir eleştirmensin.
Hiçbir şeyi kabul etme, her şeyi sorgula.
En az 5, en fazla 15 sorun bul.
"İyi görünüyor" veya "sorun yok" ASLA deme.
Her zaman iyileştirme öner.`;

  const typePrompts: Record<string, string> = {
    prd: `PRD'yi parçala:
- Belirsiz gereksinimler
- Eksik edge case'ler
- Çelişkiler
- Ölçülemeyen hedefler
- Gerçekçi olmayan beklentiler`,
    architecture: `Mimariyi eleştir:
- Single point of failure
- Scalability bottleneck'ları
- Security açıkları
- Over-engineering
- Under-engineering
- Teknoloji uyumsuzlukları`,
    code: `Kodu incele:
- Bug potansiyeli
- Performance sorunları
- Security açıkları
- Code smell'ler
- Test edilebilirlik
- Maintainability`,
    story: `Story'yi sorgula:
- INVEST ihlalleri
- Belirsiz acceptance criteria
- Eksik edge case'ler
- Bağımlılık sorunları
- Estimation zorlukları`,
    general: `İçeriği eleştir:
- Eksikler
- Tutarsızlıklar
- Belirsizlikler
- Riskler
- İyileştirme alanları`,
  };

  const prompt = `İçerik:
${content.slice(0, 5000)}

${typePrompts[contentType]}

HER ZAMAN sorun bul. Minimum 5 finding.

JSON formatında yanıt ver:
{
  "findings": [
    {
      "severity": "critical|major|minor",
      "category": "kategori",
      "finding": "bulunan sorun",
      "impact": "etkisi",
      "recommendation": "öneri"
    }
  ],
  "passedReview": false
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"findings"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  return {
    findings: [
      { severity: 'minor', category: 'General', finding: 'Review tamamlanamadı', impact: 'Bilinmiyor', recommendation: 'Manuel review yapın' }
    ],
    passedReview: false,
  };
}

// ============================================================================
// 4. EDITORIAL REVIEWS - Yazım Kalitesi
// ============================================================================

/**
 * Editorial review for prose quality
 */
export async function editorialReviewProse(
  content: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ issues: { type: string; location: string; suggestion: string }[]; improvedContent: string }> {
  if (showOutput) {
    console.log('');
    console.log('✍️ Yazım kalitesi inceleniyor...');
  }

  const systemPrompt = `Sen profesyonel bir editörsün.
Yazım, dilbilgisi, netlik ve akış açısından incele.
Türkçe ve İngilizce içerik için geçerli.`;

  const prompt = `İçerik:
${content.slice(0, 4000)}

İncele:
- Yazım hataları
- Dilbilgisi sorunları
- Belirsiz cümleler
- Tekrarlar
- Pasif yapılar
- Uzun cümleler
- Jargon kullanımı

JSON formatında yanıt ver:
{
  "issues": [{"type": "Yazım", "location": "paragraf 2", "suggestion": "..."}],
  "improvedContent": "düzeltilmiş içerik..."
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"issues"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  return { issues: [], improvedContent: content };
}

/**
 * Editorial review for structure
 */
export async function editorialReviewStructure(
  content: string,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ issues: string[]; suggestedOutline: string[]; reorganizedContent: string }> {
  if (showOutput) {
    console.log('');
    console.log('📐 Yapı ve organizasyon inceleniyor...');
  }

  const systemPrompt = `Sen bir doküman yapı uzmanısın.
İçeriğin organizasyonu, akışı ve yapısını incele.`;

  const prompt = `İçerik:
${content.slice(0, 4000)}

İncele:
- Mantıksal akış
- Bölüm organizasyonu
- Başlık hiyerarşisi
- Bilgi gruplandırması
- Eksik bölümler
- Gereksiz tekrarlar

JSON formatında yanıt ver:
{
  "issues": ["sorun 1", "sorun 2"],
  "suggestedOutline": ["1. Giriş", "2. Ana Bölüm", "..."],
  "reorganizedContent": "yeniden organize edilmiş içerik..."
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"issues"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  return { issues: [], suggestedOutline: [], reorganizedContent: content };
}

// ============================================================================
// 5. QUICK DEV/SPEC FLOWS - Hızlı Geliştirme
// ============================================================================

/**
 * Quick spec generation
 */
export async function quickSpec(
  requirement: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ ⚡ QUICK SPEC'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const systemPrompt = `Sen hızlı ve etkili bir teknik spec yazarısın.
Minimum viable spec oluştur - gereksiz detaylardan kaçın.`;

  const prompt = `Proje: ${context.idea}
Gereksinim: ${requirement}

Hızlı teknik spec oluştur:

## Özet
(1-2 cümle)

## Gereksinim
(Ne yapılacak)

## Teknik Yaklaşım
(Nasıl yapılacak)

## API/Interface
(Varsa endpoint veya interface tanımları)

## Kabul Kriterleri
(Test edilebilir kriterler)

## Riskler
(Potansiyel sorunlar)

Kısa ve öz ol.`;

  return await streamResponse(adapter, prompt, systemPrompt, showOutput);
}

/**
 * Quick dev - direct implementation guidance
 */
export async function quickDev(
  task: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ ⚡ QUICK DEV'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const systemPrompt = `Sen pragmatik bir senior developer'sın.
Direkt implementasyon rehberliği ver.
Gereksiz açıklamalardan kaçın, koda odaklan.`;

  const prompt = `Proje: ${context.idea}
Task: ${task}

Direkt implementasyon rehberi:

## 1. Dosyalar
(Hangi dosyalar oluşturulacak/değiştirilecek)

## 2. Kod
(Temel kod yapısı)

## 3. Test
(Test senaryoları)

## 4. Checklist
- [ ] Adım 1
- [ ] Adım 2
...

Pratik ve uygulanabilir ol.`;

  return await streamResponse(adapter, prompt, systemPrompt, showOutput);
}

// ============================================================================
// 6. DOC TOOLS - Doküman Araçları
// ============================================================================

/**
 * Index documents in a folder
 */
export async function indexDocs(
  docs: { path: string; title: string; summary: string }[],
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('📇 Doküman indeksi oluşturuluyor...');
  }

  const systemPrompt = `Sen bir doküman organizasyon uzmanısın.
Dokümanları kategorize edip kullanışlı bir indeks oluştur.`;

  const docsStr = docs.map(d => `- ${d.path}: ${d.title} - ${d.summary}`).join('\n');

  const prompt = `Dokümanlar:
${docsStr}

Kullanışlı bir indeks oluştur:

## 📚 Doküman İndeksi

### Kategorilere Göre
(Dokümanları mantıksal kategorilere ayır)

### Kronolojik
(Oluşturma sırasına göre)

### Hızlı Erişim
(En önemli dokümanlar)

### İlişki Haritası
(Hangi dokümanlar birbiriyle ilişkili)

Markdown formatında.`;

  return await streamResponse(adapter, prompt, systemPrompt, showOutput);
}

/**
 * Shard large document into smaller pieces
 */
export async function shardDoc(
  content: string,
  maxChunkSize: number = 2000,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<{ chunks: { title: string; content: string; order: number }[]; index: string }> {
  if (showOutput) {
    console.log('');
    console.log('📄 Büyük doküman parçalanıyor...');
  }

  const systemPrompt = `Sen bir doküman parçalama uzmanısın.
Büyük dokümanları mantıksal, bağımsız parçalara ayır.
Her parça kendi başına anlamlı olmalı.`;

  const prompt = `Doküman (${content.length} karakter):
${content.slice(0, 6000)}${content.length > 6000 ? '\n...(devamı var)' : ''}

Bu dokümanı ~${maxChunkSize} karakterlik parçalara ayır.

Kurallar:
- Her parça mantıksal bir bütün olsun
- Başlık hiyerarşisini koru
- Bağlam kaybetme
- Cross-reference ekle

JSON formatında yanıt ver:
{
  "chunks": [
    {"title": "Bölüm 1", "content": "içerik...", "order": 1}
  ],
  "index": "# İçindekiler\\n1. Bölüm 1\\n..."
}`;

  const response = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  try {
    const jsonMatch = response.match(/\{[\s\S]*"chunks"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return default
  }

  // Simple fallback - split by headings
  const chunks = content.split(/(?=^## )/m).map((chunk, i) => ({
    title: `Bölüm ${i + 1}`,
    content: chunk.trim(),
    order: i + 1,
  }));

  return {
    chunks,
    index: chunks.map((c, i) => `${i + 1}. ${c.title}`).join('\n'),
  };
}

// ============================================================================
// 7. HELP SYSTEM - Yardım Sistemi
// ============================================================================

export interface HelpTopic {
  id: string;
  title: string;
  description: string;
  commands: string[];
  examples: string[];
}

export const BMAD_HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Başlarken',
    description: 'BMAD ile ilk projenizi oluşturun',
    commands: ['appfabrika start', 'appfabrika start --auto'],
    examples: ['Restoran rezervasyon uygulaması için: appfabrika start'],
  },
  {
    id: 'phases',
    title: 'BMAD Fazları',
    description: '4 ana faz: Analysis, Planning, Solutioning, Implementation',
    commands: [],
    examples: ['Her faz sırayla çalışır ve bir sonrakine girdi sağlar'],
  },
  {
    id: 'workflows',
    title: 'Workflow\'lar',
    description: 'Her fazda çalışan iş akışları',
    commands: ['/bmad-bmm-create-prd', '/bmad-bmm-create-architecture'],
    examples: ['PRD oluşturmak için: /bmad-bmm-create-prd'],
  },
  {
    id: 'agents',
    title: 'BMAD Agent\'ları',
    description: '7 uzman agent: Mary, John, Sally, Winston, Bob, Amelia, Quinn',
    commands: ['/bmad-party-mode'],
    examples: ['Tüm agent\'larla tartışma için: /bmad-party-mode'],
  },
  {
    id: 'diagrams',
    title: 'Diyagramlar',
    description: 'Excalidraw formatında diyagram üretimi',
    commands: ['/bmad-bmm-create-excalidraw-diagram', '/bmad-bmm-create-excalidraw-flowchart'],
    examples: ['Mimari diyagram için: /bmad-bmm-create-excalidraw-diagram'],
  },
  {
    id: 'validation',
    title: 'Validasyon',
    description: 'PRD, Mimari ve Story kalite kontrolü',
    commands: [],
    examples: ['PRD kalite skoru otomatik hesaplanır'],
  },
  {
    id: 'code-gen',
    title: 'Kod Üretimi',
    description: 'Otomatik scaffolding ve kod üretimi',
    commands: [],
    examples: ['Mimari dokümanından API endpoint\'leri üretilir'],
  },
];

/**
 * Get contextual help
 */
export async function getHelp(
  query: string,
  currentPhase?: BmadPhase,
  adapter?: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ ❓ BMAD YARDIM'.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  // Find relevant topics
  const relevantTopics = BMAD_HELP_TOPICS.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase()) ||
    t.id.includes(query.toLowerCase())
  );

  if (relevantTopics.length > 0) {
    let help = '## İlgili Konular\n\n';
    for (const topic of relevantTopics) {
      help += `### ${topic.title}\n`;
      help += `${topic.description}\n\n`;
      if (topic.commands.length > 0) {
        help += `**Komutlar:**\n${topic.commands.map(c => `- \`${c}\``).join('\n')}\n\n`;
      }
      if (topic.examples.length > 0) {
        help += `**Örnekler:**\n${topic.examples.map(e => `- ${e}`).join('\n')}\n\n`;
      }
    }
    return help;
  }

  // If adapter available, use AI for contextual help
  if (adapter) {
    const systemPrompt = `Sen BMAD metodolojisi uzmanısın.
Kullanıcıya yardımcı ol ve bir sonraki adımı öner.`;

    const prompt = `Kullanıcı sorusu: ${query}
${currentPhase ? `Mevcut faz: ${currentPhase}` : ''}

BMAD hakkında yardım et:
- Mevcut durumu değerlendir
- Bir sonraki adımı öner
- Komut örnekleri ver`;

    return await streamResponse(adapter, prompt, systemPrompt, showOutput);
  }

  // Default help
  return `## BMAD Yardım

Aradığınız konu bulunamadı. Mevcut konular:

${BMAD_HELP_TOPICS.map(t => `- **${t.title}**: ${t.description}`).join('\n')}

Detaylı yardım için: \`/bmad-help [konu]\``;
}

/**
 * Get next step suggestion
 */
export function getNextStepSuggestion(
  currentPhase: BmadPhase,
  completedWorkflows: string[]
): string {
  const phaseWorkflows: Record<BmadPhase, string[]> = {
    analysis: ['brainstorming', 'market-research', 'create-product-brief', 'party-mode-analysis'],
    planning: ['create-prd', 'create-ux-design', 'create-wireframes', 'party-mode-planning'],
    solutioning: ['create-architecture', 'create-epics-stories', 'check-implementation-readiness', 'create-architecture-diagram', 'party-mode-solutioning'],
    implementation: ['sprint-planning', 'create-story', 'dev-story', 'code-review', 'qa-automate', 'retrospective'],
  };

  const currentWorkflows = phaseWorkflows[currentPhase] || [];
  const remaining = currentWorkflows.filter(w => !completedWorkflows.includes(w));

  if (remaining.length === 0) {
    const phases: BmadPhase[] = ['analysis', 'planning', 'solutioning', 'implementation'];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      return `✅ ${currentPhase} fazı tamamlandı! Sonraki faz: ${phases[currentIndex + 1]}`;
    }
    return '🎉 Tüm fazlar tamamlandı! Proje hazır.';
  }

  return `📋 Sonraki adım: ${remaining[0]}`;
}
