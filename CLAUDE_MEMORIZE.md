# Claude Code Memorize - Social Archiver 핵심 스펙

## 🎯 프로젝트 핵심 정보

### 프로젝트명: Social Archiver (Obsidian Plugin)
- **목적**: 소셜 미디어 포스트를 Obsidian 노트로 아카이빙
- **지원 플랫폼**: Facebook, LinkedIn, Instagram, TikTok, X.com, Threads
- **핵심 가치**: "Save what matters" - 사용자 데이터 소유권

## 🛠 기술 스택 (필수 암기)

```typescript
const techStack = {
  frontend: {
    framework: "Svelte 5 (Runes API)",
    language: "TypeScript 5.0+",
    styles: "Tailwind CSS v3 (no preflight) + Obsidian CSS Variables",
    bundler: "Vite (with @codewithcheese/vite-plugin-obsidian)"
  },
  backend: {
    scraping: "BrightData API",
    serverless: "Cloudflare Workers + KV Store",
    ai: "Perplexity API (deep research)",
    licensing: "Gumroad API"
  },
  obsidian: {
    api: "Obsidian Plugin API",
    storage: "Vault API",
    metadata: "MetadataCache"
  }
};
```

## 📱 모바일 퍼스트 원칙

```typescript
// 항상 모바일 우선 설계
const mobileFirst = {
  minTouchTarget: 44, // iOS HIG 최소 터치 영역
  shareExtension: true, // iOS/Android 공유 확장
  offlineFirst: true, // 오프라인 우선 저장
  disclaimer: "⚠️ Archive only content you have permission to save"
};
```

## 🏗 아키텍처 패턴 (SRP 준수)

```typescript
// 단일 책임 원칙 - 각 클래스는 하나의 책임만
export class ArchiveService {
  // API 통신만 담당
}

export class MarkdownConverter {
  // 마크다운 변환만 담당
}

export class MediaHandler {
  // 미디어 처리만 담당
  private readonly defaultImagePath = 'attachments/social-archives';
}

export class VaultManager {
  // Vault 작업만 담당
}
```

## 🪝 공통 훅 패턴 (Svelte 5 Runes)

```typescript
// 모든 컴포넌트에서 재사용
export function useArchiveState() {
  let isArchiving = $state(false);
  let error = $state<Error | null>(null);
  let progress = $state(0);
  
  return {
    get isArchiving() { return isArchiving; },
    get error() { return error; },
    get progress() { return progress; },
    async archive(url: string) { /* ... */ }
  };
}
```

## 📋 핵심 인터페이스

```typescript
// 포스트 데이터 구조 (모든 플랫폼 통합)
interface PostData {
  platform: 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads';
  id: string;
  url: string;
  author: {
    name: string;
    url: string;
    avatar?: string;
  };
  content: {
    text: string;
    html?: string;
  };
  media: Media[];
  metadata: {
    likes?: number;
    comments?: number;
    shares?: number;
    timestamp: Date;
  };
  ai?: {
    summary: string;
    factCheck: FactCheckResult[];
    sentiment: string;
    topics: string[];
  };
}

// YAML 프론트매터 (공유 제어)
interface YamlFrontmatter {
  share: boolean;
  shareUrl?: string;
  sharePassword?: string;
  shareExpiry?: Date; // 무료: 30일, 유료: 영구
  platform: string;
  archived: Date;
  lastModified: Date;
  credits_used: number;
}
```

## 💰 가격 정책 (Obsidian 정책 준수)

```typescript
const pricing = {
  free: {
    price: 0,
    credits: 10, // 월 10회
    shareExpiry: 30 // 30일 후 자동 삭제
  },
  pro: {
    price: 19.99, // Gumroad 외부 결제
    credits: 500, // 월 500회
    shareExpiry: null, // 영구 보존
    features: ['ai_analysis', 'custom_domain'],
    activation: 'external_license_key' // 플러그인 설정에서 활성화
  }
};

// ⚠️ Obsidian 플러그인 정책
// - 커뮤니티 플러그인은 무료 배포
// - 외부 라이선스 키 검증 허용
// - 플러그인 내 직접 결제 금지
// - 설정에 기부/구매 링크 허용

// 크레딧 소비
const creditUsage = {
  basic_archive: 1,
  with_ai: 3,
  deep_research: 5
};
```

## 🔗 API 엔드포인트 패턴

```typescript
// Cloudflare Workers 라우팅
const routes = {
  archive: 'POST /api/archive',
  share: 'POST /api/share',
  getShared: 'GET /share/:id',
  verify: 'POST /api/verify-license'
};

// BrightData 통합
const brightDataEndpoints = {
  facebook: '/api/collect/facebook/post',
  instagram: '/api/collect/instagram/post',
  // ... 각 플랫폼별 엔드포인트
};
```

## 🎨 UI 컴포넌트 구조

```svelte
<!-- 미니멀 아카이브 모달 -->
<ArchiveModal>
  <URLInput />
  <AdvancedOptions expandable={true} />
  <Disclaimer text={disclaimerText} />
  <ActionButtons />
</ArchiveModal>

<!-- 플랫폼별 포스트 카드 -->
<PostCard platform={platform}>
  <PlatformHeader />
  <PostContent />
  <MediaGallery />
  <Interactions />
</PostCard>
```

## 📂 파일 구조 규칙

```typescript
// 미디어 저장 경로
const mediaPaths = {
  base: 'attachments/social-archives/',
  byPlatform: true, // facebook/, instagram/, etc
  naming: 'YYYY-MM-DD_platform_postId' // 2024-03-15_facebook_123456
};

// 노트 파일 구조
const noteStructure = {
  path: 'Social Archives/{platform}/{year}/{month}/',
  filename: '{date} - {author} - {title}.md',
  example: 'Social Archives/Facebook/2024/03/2024-03-15 - John Doe - Product Launch.md'
};
```

## ⚡ 성능 최적화 규칙

```typescript
// 항상 적용할 최적화
const optimizations = {
  lazyLoading: true, // 이미지/비디오 지연 로딩
  virtualScrolling: true, // 긴 목록 가상 스크롤
  offlineFirst: true, // 로컬 저장 우선
  batchRequests: true, // API 요청 배치 처리
  cacheStrategy: 'stale-while-revalidate'
};
```

## 🔐 보안 체크리스트

```typescript
const security = {
  // 절대 하지 말아야 할 것
  never: [
    "API 키를 코드에 하드코딩",
    "사용자 데이터를 평문 전송",
    "크레딧 검증 없이 API 호출"
  ],
  // 항상 해야 할 것
  always: [
    "HTTPS 전송",
    "입력 값 검증",
    "Rate limiting",
    "Disclaimer 표시"
  ]
};
```

## 🚀 장기 비전 (참고)

```typescript
// Phase 1: Social Archiver (현재)
const phase1 = "아카이빙 플러그인";

// Phase 2: Very Very Social (미래)
const phase2 = "독립 SNS 플랫폼 (별도 프로젝트)";

// 두 제품은 독립적이지만 시너지 효과
const synergy = {
  archiver: "Save what matters",
  social: "Share what you think"
};
```

## 🎯 코딩 컨벤션

```typescript
// TypeScript Strict Mode 필수
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// Svelte 5 Runes 사용
let count = $state(0); // ✅
let count = 0; // ❌

// 에러 처리 패턴
try {
  await archive(url);
} catch (error) {
  if (error instanceof ArchiveError) {
    Notice.show(error.userMessage);
  }
  console.error('[Social Archiver]', error);
}

// 항상 타입 정의
function processPost(data: PostData): Promise<TFile> // ✅
function processPost(data: any): Promise<any> // ❌
```

## 📝 커밋 메시지 규칙

```bash
feat: 새 기능 추가
fix: 버그 수정
refactor: 코드 개선
docs: 문서 업데이트
test: 테스트 추가/수정
chore: 빌드/설정 변경

# 예시
git commit -m "feat: implement Facebook post archiving (task 4.1)"
git commit -m "fix: handle rate limiting in BrightData API"
```

## ⚠️ 주의사항

1. **모바일 우선**: 모든 UI는 모바일에서 먼저 테스트
2. **오프라인 우선**: 네트워크 없어도 기본 기능 작동
3. **SRP 준수**: 한 클래스/함수는 하나의 일만
4. **타입 안전**: any 타입 사용 금지
5. **에러 처리**: 모든 async 함수에 try-catch
6. **Disclaimer**: 모든 아카이빙 UI에 법적 안내 표시

---

**이 문서의 내용을 Claude Code 세션 시작 시 참고하여 일관된 개발을 진행하세요.**