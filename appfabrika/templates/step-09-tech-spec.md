# {{stepName}} - Teknik Şartname

## Proje Fikri

{{projectIdea}}

## Önceki Adımlar

{{allPreviousOutputs}}

## Görev

Mimari kararları ve sprint planlamasını temel alarak detaylı bir Teknik Şartname (Tech Spec) dokümanı oluştur. Bu belge, geliştiriciler için implementasyon rehberi olacak.

### 1. Teknik Genel Bakış

- Sistem bileşenleri özeti
- Teknoloji stack özeti
- Deployment mimarisi özeti

### 2. Proje Yapısı

```
project-root/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── utils/
│   └── types/
├── tests/
├── docs/
└── config/
```

Her klasör için:
- Amaç
- İçerik kuralları
- Naming conventions

### 3. Kod Standartları

**Naming Conventions:**
- Dosyalar: kebab-case
- Classlar: PascalCase
- Fonksiyonlar: camelCase
- Sabitler: SCREAMING_SNAKE_CASE

**Code Style:**
- Linting kuralları
- Formatting kuralları
- Import sıralaması

### 4. API Endpoint Detayları

Her endpoint için:

```
POST /api/v1/resource
Description: [Açıklama]

Request:
{
  "field1": "type",
  "field2": "type"
}

Response (200):
{
  "data": {},
  "meta": {}
}

Response (4xx/5xx):
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

### 5. Database Schema

**Tablolar:**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**İlişkiler:**
- users → orders (1:N)
- ...

**İndeksler:**
- idx_users_email
- ...

### 6. Authentication & Authorization

- Auth flow açıklaması
- Token yapısı
- Permission modeli
- Session yönetimi

### 7. Error Handling

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_001 | 401 | Invalid credentials |
| AUTH_002 | 403 | Insufficient permissions |

**Error Response Format:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": {}
  }
}
```

### 8. Testing Strategy

**Unit Tests:**
- Test framework
- Coverage hedefi
- Mock stratejisi

**Integration Tests:**
- Test scenarios
- Test data management

**E2E Tests:**
- Critical paths
- Test environment

### 9. Environment Configuration

```env
# Database
DATABASE_URL=
DATABASE_POOL_SIZE=

# Auth
JWT_SECRET=
JWT_EXPIRY=

# External Services
API_KEY_SERVICE_X=
```

### 10. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| | | |

### 11. Build & Deploy

**Build Steps:**
```bash
npm install
npm run build
npm run test
```

**Deploy Steps:**
```bash
# Staging
npm run deploy:staging

# Production
npm run deploy:prod
```

## Çıktı Formatı

Detaylı teknik dokümantasyon formatında, kod örnekleri ve şemalar içeren bir belge oluştur. Yeni başlayan bir geliştirici için yeterli detay içermeli.
