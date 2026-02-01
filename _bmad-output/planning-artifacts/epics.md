---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['prd.md', 'architecture.md']
totalEpics: 8
totalStories: 40
status: 'complete'
completedAt: '2026-01-31'
validationResults:
  frCoverage: '50/50'
  architectureCompliance: true
  storyQuality: true
  epicStructure: true
  dependencyFlow: true
---

# AppFabrika - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AppFabrika, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Proje Baslangici:**
- FR1: Kullanici `appfabrika init` komutu ile yeni proje baslatabilir
- FR2: Kullanici proje fikrini tek cumle olarak girebilir
- FR3: Kullanici LLM secimi yapabilir (GPT veya Claude API)
- FR4: Kullanici otomasyon sablonu secebilir (Full Auto / Business Manuel / Full Manuel / Custom)
- FR5: Sistem proje klasoru ve temel yapiyi olusturabilir

**BMAD Workflow:**
- FR6: Sistem BMAD Brainstorming adimini calistirabilir
- FR7: Sistem BMAD Research adimini calistirabilir (Market/Technical/Domain)
- FR8: Sistem BMAD Product Brief adimini calistirabilir
- FR9: Sistem BMAD PRD adimini calistirabilir
- FR10: Sistem BMAD UX Design adimini calistirabilir
- FR11: Sistem BMAD Architecture adimini calistirabilir
- FR12: Sistem BMAD Epics & Stories adimini calistirabilir
- FR13: Sistem BMAD Sprint Planning adimini calistirabilir
- FR14: Sistem BMAD Tech Spec adimini calistirabilir
- FR15: Sistem BMAD Development (kod uretimi) adimini calistirabilir
- FR16: Sistem BMAD Code Review adimini calistirabilir
- FR17: Sistem BMAD QA/Testing adimini calistirabilir
- FR18: Sistem BMAD adimlarini sirali olarak yurutebilir
- FR19: Sistem her BMAD adiminin ciktisini kaydedebilir
- FR20: Sistem manuel tamamlanan adimlari algilayip sonraki adima gecebilir
- FR21: Kullanici istenen adimi atlayabilir (skip)
- FR22: Kullanici atlanan adima geri donebilir

**LLM Entegrasyonu:**
- FR23: Sistem LLM API'ye BMAD sorularini gonderebilir
- FR24: Sistem LLM'den gelen cevaplari alabilir
- FR25: Sistem LLM cevaplarini BMAD formatina donusturebilir
- FR26: Kullanici farkli LLM saglayicilari kullanabilir

**Otomasyon Yonetimi:**
- FR27: Kullanici her BMAD adimi icin ayri ayri otomasyon/manuel secimi yapabilir
- FR28: Kullanici calisma sirasinda herhangi bir adimi otomasyona alabilir
- FR29: Kullanici calisma sirasinda herhangi bir adimi manuel'e gecirebilir
- FR30: Kullanici "Full Auto" sablonunu secebilir
- FR31: Kullanici "Business Manuel" sablonunu secebilir
- FR32: Kullanici "Full Manuel" sablonunu secebilir
- FR33: Kullanici "Custom" sablonuyla adim adim secim yapabilir
- FR34: Sistem kullanicinin secimlerini hatirlayip sonraki projelerde onerebilir

**Hata Yonetimi:**
- FR35: Sistem hata durumunda otomatik yeniden deneyebilir (3 deneme)
- FR36: Sistem yeniden deneme arasinda bekleme suresi uygulayabilir
- FR37: Sistem 3 deneme sonrasi anlasilir hata mesaji gosterebilir
- FR38: Sistem hata durumunda projeyi kurtarma noktasindan devam ettirebilir

**Terminal Arayuzu:**
- FR39: Sistem mevcut BMAD adimini gosterebilir
- FR40: Sistem her adimin otomasyon/manuel durumunu gosterebilir
- FR41: Sistem ilerleme durumunu canli gosterebilir
- FR42: Sistem tamamlanan adimlari isaretleyebilir
- FR43: Sistem proje tamamlandiginda ozet gosterebilir

**Konfigurasyon:**
- FR44: Kullanici LLM API key'ini bir kere girip kaydedebilir
- FR45: Sistem konfigurasyon dosyasini guvenli saklayabilir
- FR46: Kullanici varsayilan otomasyon sablonunu kaydedebilir
- FR47: Kullanici varsayilan LLM tercihini kaydedebilir

**GitHub Entegrasyonu:**
- FR48: Sistem proje tamamlandiginda GitHub reposu olusturabilir
- FR49: Sistem kodu GitHub'a push edebilir
- FR50: Sistem proje tamamlandiginda repo URL'sini gosterebilir

### NonFunctional Requirements

**Performance:**
- NFR1: BMAD adim gecisleri kullaniciyi 5 saniyeden fazla bekletmemeli
- NFR2: LLM API cevaplari 30 saniye icinde alinmali (timeout)
- NFR3: Terminal UI guncellemeleri anlik olmali (<100ms)
- NFR4: Proje baslangici (init) 3 saniye icinde tamamlanmali

**Security:**
- NFR5: LLM API key'leri sifrelenmis olarak saklanmali
- NFR6: API key'ler log'larda veya hata mesajlarinda gorunmemeli
- NFR7: Konfigurasyon dosyasi sadece kullanici tarafindan okunabilir olmali (chmod 600)

**Integration:**
- NFR8: OpenAI API (GPT) ile uyumlu olmali
- NFR9: Anthropic API (Claude) ile uyumlu olmali
- NFR10: Claude Code CLI ile sorunsuz calisabilmeli
- NFR11: GitHub API (gh CLI) ile uyumlu olmali

**Reliability:**
- NFR12: LLM API hatalari otomatik retry ile %70 oraninda kurtarilabilmeli
- NFR13: Network hatalari 3 denemeye kadar otomatik tekrarlanmali
- NFR14: Proje durumu her adimda kaydedilmeli (crash recovery)
- NFR15: Yarida kalan projeler kaldigi yerden devam edebilmeli

### Additional Requirements

**Architecture Decisions:**
- Starter Template: Commander.js + @clack/prompts + ora + chalk + TypeScript
- Katmanli Servis Mimarisi (CLI → Orchestration → Integration → Foundation)
- ADR-001: Streaming Response for LLM API communication
- ADR-002: Hybrid State Persistence (JSON + Checkpoint files)
- ADR-003: File-Based Claude Code Communication
- ADR-004: State Machine for workflow management

**Project Structure:**
- src/cli/ - CLI Layer (commands, ui)
- src/services/ - Orchestration Layer (workflow, automation, state)
- src/adapters/ - Integration Layer (llm, claude-code)
- src/core/ - Foundation Layer (config, error, logger)
- src/types/ - TypeScript definitions
- templates/ - BMAD prompt templates

**Implementation Patterns:**
- File naming: kebab-case.ts
- Functions: camelCase
- Classes: PascalCase
- BMAD steps: step-XX-name format
- Logs: [timestamp] [level] [context] message

### FR Coverage Map

| FR | Epic | Açıklama |
|----|------|----------|
| FR1 | Epic 2 | init komutu |
| FR2 | Epic 2 | Fikir girişi |
| FR3 | Epic 2 | LLM seçimi |
| FR4 | Epic 2 | Otomasyon şablonu |
| FR5 | Epic 2 | Proje klasörü oluşturma |
| FR6-17 | Epic 4 | 12 BMAD adımı |
| FR18 | Epic 4 | Sıralı yürütme |
| FR19 | Epic 4 | Çıktı kaydetme |
| FR20 | Epic 4 | Manuel adım algılama |
| FR21 | Epic 5 | Adım atlama |
| FR22 | Epic 5 | Geri dönme |
| FR23-26 | Epic 3 | LLM API iletişimi |
| FR27-29 | Epic 5 | Dinamik otomasyon |
| FR30-33 | Epic 2 | Otomasyon şablonları |
| FR34 | Epic 5 | Tercih hatırlama |
| FR35-38 | Epic 7 | Hata yönetimi |
| FR39-43 | Epic 6 | Terminal UI |
| FR44-47 | Epic 1 | Konfigürasyon |
| FR48-50 | Epic 8 | GitHub entegrasyonu |

## Epic List

### Epic 1: CLI Foundation & Configuration
**Kullanıcı Değeri:** AppFabrika'yı kurabilir ve yapılandırabilir

Kullanıcı CLI aracını kurar, API key'lerini güvenli şekilde saklar ve varsayılan tercihlerini ayarlar.

**FRs:** FR44, FR45, FR46, FR47
**NFRs:** NFR5, NFR6, NFR7

---

### Epic 2: Project Initialization
**Kullanıcı Değeri:** Fikrini girip yeni proje başlatabilir

Kullanıcı tek komutla yeni proje başlatır, fikrini yazar, LLM ve otomasyon seviyesi seçer.

**FRs:** FR1, FR2, FR3, FR4, FR5, FR30, FR31, FR32, FR33

---

### Epic 3: LLM Integration
**Kullanıcı Değeri:** Sistem LLM API'leri ile iletişim kurabilir

Sistem OpenAI ve Anthropic API'leri ile streaming iletişim kurabilir, cevapları BMAD formatına dönüştürebilir.

**FRs:** FR23, FR24, FR25, FR26
**NFRs:** NFR2, NFR8, NFR9

---

### Epic 4: BMAD Workflow Engine
**Kullanıcı Değeri:** Sistem 12 adımlık BMAD workflow'unu çalıştırabilir

Sistem tüm BMAD adımlarını sırayla çalıştırır, her adımın çıktısını kaydeder, Claude Code ile entegre çalışır.

**FRs:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20

---

### Epic 5: Workflow Control & Automation
**Kullanıcı Değeri:** Kullanıcı adımları atlayabilir, geri dönebilir, otomasyon değiştirebilir

Kullanıcı çalışma sırasında herhangi bir adımı atlayabilir, geri dönebilir, otomasyon modunu değiştirebilir.

**FRs:** FR21, FR22, FR27, FR28, FR29, FR34

---

### Epic 6: Terminal Experience
**Kullanıcı Değeri:** Kullanıcı ilerlemeyi ve durumu net görebilir

Kullanıcı terminalde BMAD adımlarının durumunu, ilerlemeyi ve tamamlanma özetini görür.

**FRs:** FR39, FR40, FR41, FR42, FR43
**NFRs:** NFR1, NFR3, NFR4

---

### Epic 7: Error Handling & Recovery
**Kullanıcı Değeri:** Sistem hatalardan otomatik kurtulabilir

Sistem LLM ve network hatalarında otomatik retry yapar, checkpoint'lerden kurtarma sağlar.

**FRs:** FR35, FR36, FR37, FR38
**NFRs:** NFR12, NFR13, NFR14, NFR15

---

### Epic 8: GitHub Integration & Completion
**Kullanıcı Değeri:** Proje GitHub'a yüklenir, kullanıcı sonucu görür

Proje tamamlandığında GitHub'a push edilir, kullanıcıya repo URL'si ve sonraki adımlar gösterilir.

**FRs:** FR48, FR49, FR50
**NFRs:** NFR10, NFR11

---

## Epic 1: CLI Foundation & Configuration - Stories

### Story 1.1: Project Setup with Starter Template

As a **developer**,
I want **to initialize the AppFabrika project with the defined starter template**,
So that **the project has proper TypeScript configuration and dependencies**.

**Acceptance Criteria:**

**Given** the starter template is defined in Architecture
**When** I run the project initialization
**Then** package.json is created with all dependencies (commander, clack, ora, chalk, openai, anthropic)
**And** tsconfig.json is configured for TypeScript
**And** the project structure matches Architecture spec

---

### Story 1.2: Config File Management

As a **user**,
I want **AppFabrika to create and manage a config file**,
So that **my preferences are saved between sessions**.

**Acceptance Criteria:**

**Given** no config file exists
**When** I run appfabrika for the first time
**Then** ~/.appfabrika/config.json is created with default values
**And** the file permissions are set to chmod 600

---

### Story 1.3: API Key Secure Storage

As a **user**,
I want **to save my LLM API keys securely**,
So that **I don't have to enter them every time**.

**Acceptance Criteria:**

**Given** I am setting up AppFabrika
**When** I enter my OpenAI or Anthropic API key
**Then** the key is saved to ~/.appfabrika/.env
**And** the file permissions are set to chmod 600
**And** the key never appears in logs or error messages

---

### Story 1.4: Default Preferences

As a **user**,
I want **to set default LLM and automation preferences**,
So that **new projects use my preferred settings**.

**Acceptance Criteria:**

**Given** I have configured AppFabrika
**When** I set a default LLM provider
**Then** new projects will use that provider by default

---

## Epic 2: Project Initialization - Stories

### Story 2.1: Init Command Entry Point

As a **user**,
I want **to run `appfabrika init` to start a new project**,
So that **I can begin the BMAD workflow**.

**Acceptance Criteria:**

**Given** AppFabrika is installed globally
**When** I run `appfabrika init`
**Then** the initialization flow starts with a welcome message
**And** the process completes in under 3 seconds

---

### Story 2.2: Idea Input

As a **user**,
I want **to enter my project idea in a single sentence**,
So that **the system understands what I want to build**.

**Acceptance Criteria:**

**Given** I am in the init flow
**When** I am prompted for my idea
**Then** I can enter a free-text description
**And** the idea is saved to the project state

---

### Story 2.3: LLM Provider Selection

As a **user**,
I want **to choose which LLM provider to use**,
So that **I can use my preferred AI model**.

**Acceptance Criteria:**

**Given** I have entered my idea
**When** I am prompted for LLM selection
**Then** I see options: OpenAI (GPT) and Anthropic (Claude)
**And** my selection is saved to project config

---

### Story 2.4: Automation Template Selection

As a **user**,
I want **to choose my automation level**,
So that **I can control how much manual input is required**.

**Acceptance Criteria:**

**Given** I have selected an LLM
**When** I am prompted for automation template
**Then** I see: "Hızlı Başla (Full Auto)" and "Adım Adım (Checkpoint)"
**And** my selection determines the automation mode for all BMAD steps

---

### Story 2.5: Project Folder Creation

As a **user**,
I want **the system to create a project folder structure**,
So that **my project files are organized**.

**Acceptance Criteria:**

**Given** I have completed all init prompts
**When** the initialization completes
**Then** a project folder is created with the project name
**And** .appfabrika/ folder is created inside with config and checkpoints

---

## Epic 3: LLM Integration - Stories

### Story 3.1: LLM Adapter Interface

As a **developer**,
I want **a common interface for LLM adapters**,
So that **different LLM providers can be used interchangeably**.

**Acceptance Criteria:**

**Given** the adapter pattern from Architecture
**When** I implement the LLMAdapter interface
**Then** it includes stream(), complete(), and validateKey() methods

---

### Story 3.2: OpenAI Adapter

As a **system**,
I want **to communicate with OpenAI API**,
So that **users can use GPT models for BMAD**.

**Acceptance Criteria:**

**Given** a valid OpenAI API key is configured
**When** the system sends a BMAD prompt
**Then** the response is streamed back
**And** timeout is set to 30 seconds

---

### Story 3.3: Anthropic Adapter

As a **system**,
I want **to communicate with Anthropic API**,
So that **users can use Claude models for BMAD**.

**Acceptance Criteria:**

**Given** a valid Anthropic API key is configured
**When** the system sends a BMAD prompt
**Then** the response is streamed back
**And** timeout is set to 30 seconds

---

### Story 3.4: Response Transformation

As a **system**,
I want **to transform LLM responses to BMAD format**,
So that **responses are structured for workflow processing**.

**Acceptance Criteria:**

**Given** an LLM streaming response
**When** the response completes
**Then** it is parsed and validated for BMAD step requirements

---

## Epic 4: BMAD Workflow Engine - Stories

### Story 4.1: Workflow State Machine

As a **system**,
I want **a state machine to manage BMAD workflow**,
So that **step execution is controlled and predictable**.

**Acceptance Criteria:**

**Given** the ADR-004 State Machine decision
**When** the workflow starts
**Then** state machine tracks: current step, step status, automation mode

---

### Story 4.2: BMAD Step Registry

As a **system**,
I want **a registry of all 12 BMAD steps**,
So that **each step can be executed in sequence**.

**Acceptance Criteria:**

**Given** the BMAD methodology
**When** the workflow is initialized
**Then** all 12 steps are registered (step-01 through step-12)

---

### Story 4.3: Claude Code Adapter

As a **system**,
I want **to execute BMAD steps via Claude Code**,
So that **files are created and code is generated**.

**Acceptance Criteria:**

**Given** ADR-003 File-Based Communication
**When** a BMAD step needs execution
**Then** prompt is written to .appfabrika/prompt.md
**And** Claude Code is invoked with the prompt file

---

### Story 4.4: Business Steps Execution

As a **user**,
I want **the system to execute business BMAD steps (1-4)**,
So that **my idea is analyzed and documented**.

**Acceptance Criteria:**

**Given** the workflow has started
**When** business steps execute
**Then** Brainstorming, Research, Product Brief, and PRD steps complete

---

### Story 4.5: Design Steps Execution

As a **user**,
I want **the system to execute design BMAD steps (5-7)**,
So that **my product is architected properly**.

**Acceptance Criteria:**

**Given** business steps are complete
**When** design steps execute
**Then** UX Design, Architecture, and Epics & Stories steps complete

---

### Story 4.6: Technical Steps Execution

As a **user**,
I want **the system to execute technical BMAD steps (8-12)**,
So that **my product is built and tested**.

**Acceptance Criteria:**

**Given** design steps are complete
**When** technical steps execute
**Then** Sprint Planning, Tech Spec, Development, Code Review, and QA steps complete

---

### Story 4.7: Step Output Persistence

As a **system**,
I want **to save each step's output**,
So that **progress is preserved and recoverable**.

**Acceptance Criteria:**

**Given** ADR-002 Hybrid State Persistence
**When** a step completes
**Then** output is saved to .appfabrika/checkpoints/step-XX-name.json

---

### Story 4.8: Sequential Step Execution

As a **system**,
I want **to execute steps in order**,
So that **each step builds on previous outputs**.

**Acceptance Criteria:**

**Given** a multi-step workflow
**When** the workflow runs
**Then** steps execute in order (1 through 12)

---

### Story 4.9: Manual Step Detection

As a **system**,
I want **to detect manually completed steps**,
So that **the workflow can continue from where the user left off**.

**Acceptance Criteria:**

**Given** a step marked as manual
**When** the user completes it outside the CLI
**Then** the system detects the output file exists and proceeds

---

## Epic 5: Workflow Control & Automation - Stories

### Story 5.1: Skip Step Functionality

As a **user**,
I want **to skip a BMAD step**,
So that **I can proceed without completing optional steps**.

**Acceptance Criteria:**

**Given** a step is in progress or pending
**When** I select the skip option [s]
**Then** the step is marked as skipped and workflow proceeds

---

### Story 5.2: Go Back to Previous Step

As a **user**,
I want **to go back to a previous step**,
So that **I can revise earlier decisions**.

**Acceptance Criteria:**

**Given** I am on step N (where N > 1)
**When** I select the back option [b]
**Then** I return to step N-1

---

### Story 5.3: Per-Step Automation Control

As a **user**,
I want **to set automation mode for each step individually**,
So that **I have fine-grained control over the workflow**.

**Acceptance Criteria:**

**Given** I am running the workflow
**When** I view the current step
**Then** I see [m] to switch to manual and [a] to switch to auto

---

### Story 5.4: Runtime Mode Switching

As a **user**,
I want **to switch between auto and manual mode during execution**,
So that **I can take control when needed**.

**Acceptance Criteria:**

**Given** I am in any mode
**When** I press [m] or [a]
**Then** that step switches to the selected mode

---

### Story 5.5: Preference Persistence

As a **user**,
I want **the system to remember my automation choices**,
So that **future projects suggest my preferred settings**.

**Acceptance Criteria:**

**Given** I have completed a project with custom settings
**When** I start a new project
**Then** my previous preferences are suggested

---

## Epic 6: Terminal Experience - Stories

### Story 6.1: Current Step Display

As a **user**,
I want **to see which BMAD step is currently running**,
So that **I know where I am in the workflow**.

**Acceptance Criteria:**

**Given** a BMAD step is in progress
**When** I look at the terminal
**Then** I see the step name with emoji and description

---

### Story 6.2: Step Status Overview

As a **user**,
I want **to see the status of all BMAD steps**,
So that **I understand overall progress**.

**Acceptance Criteria:**

**Given** the workflow is running
**When** I view the progress display
**Then** I see all 12 steps with their status indicators

---

### Story 6.3: Automation Mode Indicator

As a **user**,
I want **to see whether each step is auto or manual**,
So that **I know when my input is needed**.

**Acceptance Criteria:**

**Given** the step overview is displayed
**Then** each step shows [A] for auto or [M] for manual

---

### Story 6.4: Live Progress with Spinner

As a **user**,
I want **to see a spinner while steps are processing**,
So that **I know the system is working**.

**Acceptance Criteria:**

**Given** a step is executing
**When** waiting for LLM response
**Then** ora spinner is displayed with descriptive text

---

### Story 6.5: Completion Summary

As a **user**,
I want **to see a summary when the project completes**,
So that **I know what was accomplished**.

**Acceptance Criteria:**

**Given** all BMAD steps complete successfully
**When** the workflow finishes
**Then** I see a completion summary with stats and next steps

---

## Epic 7: Error Handling & Recovery - Stories

### Story 7.1: Automatic Retry Mechanism

As a **system**,
I want **to automatically retry failed operations**,
So that **transient errors don't stop the workflow**.

**Acceptance Criteria:**

**Given** an LLM API call fails
**When** the error is detected
**Then** the system retries up to 3 times

---

### Story 7.2: Retry Delay Strategy

As a **system**,
I want **to wait between retry attempts**,
So that **rate limits can resolve**.

**Acceptance Criteria:**

**Given** a retry is needed
**When** the system waits
**Then** delay increases: 10s, 30s, 60s

---

### Story 7.3: User-Friendly Error Messages

As a **user**,
I want **to see clear error messages after all retries fail**,
So that **I understand what to do**.

**Acceptance Criteria:**

**Given** all 3 retry attempts have failed
**When** the final error is shown
**Then** I see friendly options: [R] Retry, [S] Save, [?] Help

---

### Story 7.4: Checkpoint Save on Error

As a **system**,
I want **to save progress when errors occur**,
So that **work is not lost**.

**Acceptance Criteria:**

**Given** an unrecoverable error occurs
**When** the workflow stops
**Then** current state is saved to checkpoint

---

### Story 7.5: Resume from Checkpoint

As a **user**,
I want **to resume a failed project from where it stopped**,
So that **I don't have to start over**.

**Acceptance Criteria:**

**Given** a project was interrupted
**When** I run `appfabrika run` again
**Then** the system asks to resume and continues from last checkpoint

---

## Epic 8: GitHub Integration & Completion - Stories

### Story 8.1: GitHub Repo Creation

As a **user**,
I want **the system to create a GitHub repository**,
So that **my project is hosted online**.

**Acceptance Criteria:**

**Given** the BMAD workflow has completed
**When** the GitHub integration step runs
**Then** Claude Code creates a new GitHub repo via gh CLI

---

### Story 8.2: Code Push to GitHub

As a **user**,
I want **my project code pushed to GitHub**,
So that **my work is safely stored**.

**Acceptance Criteria:**

**Given** a GitHub repo has been created
**When** the push step runs
**Then** all project files are committed and pushed

---

### Story 8.3: Completion Screen

As a **user**,
I want **to see a completion screen with next steps**,
So that **I know what to do with my new project**.

**Acceptance Criteria:**

**Given** the project has been pushed to GitHub
**When** the workflow completes
**Then** I see GitHub URL, local path, and next steps commands

