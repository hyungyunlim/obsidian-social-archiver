# User Post Creation Feature Specification

## 📋 Overview

사용자가 플러그인 타임라인 뷰에서 직접 포스팅을 작성하여 자신의 Social Archive에 게시할 수 있는 기능입니다. 인스타그램/페이스북 스타일의 포스팅 경험을 Obsidian 환경에서 제공합니다.

## 🎯 Core Requirements

### 1. **위치 및 접근성**
- **위치**: Timeline View 상단 (필터/정렬 컨트롤 위)
- **접근 방법**:
  - 타임라인 최상단 고정 컴포저
  - 항상 보이되, 입력 전에는 collapsed 상태
  - 클릭하면 expand되어 full editor 표시

### 2. **Post Type 구분**
- 기존 아카이브 포스트: `platform: 'facebook' | 'instagram' | ...`
- 사용자 포스트: `platform: 'post'` (새로운 platform type 추가)
- PostData 인터페이스는 동일하게 유지 (기존 구조 재사용)

### 3. **에디터 기능**

#### 3.1 텍스트 입력
- **에디터 타입**: Custom ContentEditable Div
  - Timeline View는 기존 MarkdownView가 아니므로 `Editor` API 직접 사용 불가
  - `contenteditable` div로 자체 에디터 구현
  - Markdown syntax 지원 (실시간 미리보기는 Optional)
  - 자동 링크 감지 (URL 패턴 매칭)
  - Obsidian 내부 링크 (`[[Note]]`) 입력 지원 (SuggestModal로 자동완성)
  - **Alternative**: Textarea + 마크다운 렌더링 프리뷰 (더 간단한 구현)
- **Placeholder**: "What's on your mind?" (페이스북 스타일)
- **최대 길이**: 10,000자 (Instagram 제한 참고)
- **실시간 카운터**: 하단에 `{current}/{max}` 표시
- **Markdown 지원**: 기본 syntax (`**bold**`, `_italic_`, `# heading`, `- list`, etc.)
- **API Reference**:
  - Obsidian Editor API는 `MarkdownView`에서만 접근 가능
  - Timeline View 내부에서는 DOM 직접 조작 필요

#### 3.2 링크 처리
- URL 자동 감지 및 하이라이트
- Link Preview 자동 생성 (기존 link preview 시스템 재사용)
- `linkPreviews` 필드에 자동 저장
- Preview 미리보기: URL 입력 후 2초 대기 후 자동 fetch

#### 3.3 이미지 첨부
- **첨부 방법**:
  1. 드래그 앤 드롭 (DOM `drop` 이벤트)
  2. 클릭하여 파일 선택 (`<input type="file">` 활용)
  3. 클립보드 붙여넣기 (`paste` 이벤트, Ctrl/Cmd + V)
- **지원 포맷**: PNG, JPEG, GIF, WebP
- **최대 개수**: 10개 (Instagram 제한 참고)
- **저장 위치**: `attachments/social-archives/post/{YYYY-MM-DD}/{filename}`
  - 예: `attachments/social-archives/post/2024-03-15/image-1710504123456.png`
  - **Vault API**: `vault.createBinary(path, arrayBuffer)` 사용
  - **폴더 생성**: `vault.createFolder(path)` 로 필요 시 자동 생성
- **미리보기**: Grid layout (Instagram 스타일)
- **편집 기능**:
  - 이미지 순서 변경 (드래그)
  - 개별 삭제
  - Alt text 추가 (접근성)
- **API Reference**:
  - `vault.createBinary()`: 바이너리 파일 저장
  - `vault.adapter.getResourcePath()`: 미리보기 이미지 URL 생성
  - 기존 `MediaHandler.ts` 로직 재사용

#### 3.4 비디오 첨부 (Optional - Phase 2)
- **지원 포맷**: MP4, MOV, WebM
- **최대 크기**: 100MB
- **저장 위치**: 이미지와 동일

### 4. **포스팅 옵션**

#### 4.1 Share 설정
- **토글 옵션**: "Share publicly" (기본: OFF)
- **Share ON 시 추가 옵션**:
  - Password protection (optional)
  - Expiry date (무료: 30일, Pro: 영구 or 사용자 설정)
  - Username 자동 설정 (플러그인 settings에서 가져오기)
- **Share URL 생성**: 즉시 생성 및 표시
  - Format: `https://social-archive.junlim.org/{username}/{shareId}`
  - Copy 버튼 제공

#### 4.2 추가 메타데이터
- **Tags**: Obsidian tag format (`#tag`)
  - 자동 추출 및 frontmatter에 저장
  - Tag 자동완성 (기존 vault tags)
- **Location** (optional): 텍스트 입력
- **Mood/Feeling** (optional): Emoji picker
- **Privacy**:
  - Public (share enabled)
  - Private (local only)
  - Draft (미완성)

### 5. **UI/UX 디자인**

#### 5.1 Collapsed State (초기 상태)
```
┌─────────────────────────────────────────────────────┐
│  [Avatar] What's on your mind?       [📷] [Share]   │
└─────────────────────────────────────────────────────┘
```
- 높이: 60px
- Background: `var(--background-primary)`
- Border: `1px solid var(--background-modifier-border)`
- Border radius: `12px`
- Shadow: `0 1px 3px rgba(0,0,0,0.1)`

#### 5.2 Expanded State (입력 중)
```
┌───────────────────────────────────────────────────────────┐
│  [Avatar]  [Editor - Markdown supported]                  │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │ Text content here...                               │    │
│  │                                                     │    │
│  │ Supporting [[wiki links]] and URLs                 │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  [Link Preview Card - if URL detected]                     │
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐                                  │
│  │ Img │ │ Img │ │ Img │  [+ Add more]                    │
│  └─────┘ └─────┘ └─────┘                                  │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│  📷 Add images  |  🔗 Add link  |  #️⃣ Add tags            │
│                                                             │
│  [ ] Share publicly     [ ] Password protect              │
│                                                             │
│  [Cancel]                           [Save Draft] [Post]    │
│                                    0/10,000 characters     │
└───────────────────────────────────────────────────────────┘
```
- Min height: 200px
- Max height: 600px (scrollable)
- Animation: Smooth expand (300ms ease-out)

#### 5.3 Mobile Optimization
- **Touch targets**: 최소 44x44px (iOS HIG)
- **이미지 그리드**: 모바일에서 2열, 데스크톱 3~4열
- **키보드 나타날 때 에디터 자동 스크롤**
- **Full-screen mode on mobile** (modal)
- **Platform Detection**:
  ```typescript
  import { Platform } from 'obsidian';

  if (Platform.isIosApp) {
    // iOS specific behavior
  }
  if (Platform.isAndroidApp) {
    // Android specific behavior
  }
  if (Platform.isMobile) {
    // General mobile optimizations
  }
  ```
- **Node.js API 사용 금지**: 모바일에서 사용 불가
- **Testing**: `this.app.emulateMobile(true)` 로 데스크톱에서 모바일 테스트
- **Regex Lookbehind 주의**: iOS 16.4+ 만 지원, fallback 구현 필요

### 6. **Data Flow & API Integration**

#### 6.1 Local Storage (Vault)

**File Creation**:
```typescript
// File path: Social Archives/Posts/{YYYY}/{MM}/{YYYY-MM-DD-HHMMSS}.md
// Example: Social Archives/Posts/2024/03/2024-03-15-143052.md

import { TFile } from 'obsidian';

// 1. Ensure folder exists
const folderPath = 'Social Archives/Posts/2024/03';
const folder = this.app.vault.getAbstractFileByPath(folderPath);
if (!folder) {
  await this.app.vault.createFolder(folderPath);
}

// 2. Create post file with frontmatter + content
const filePath = `${folderPath}/2024-03-15-143052.md`;
const content = `---
${frontmatterYaml}
---

${markdownContent}`;

const file: TFile = await this.app.vault.create(filePath, content);

// 3. Save images using createBinary
for (const image of images) {
  const imagePath = `attachments/social-archives/post/2024-03-15/${image.name}`;
  await this.app.vault.createBinary(imagePath, image.arrayBuffer);
}
```

**Vault API Reference**:
- `vault.create(path, content)`: 텍스트 파일 생성 (Markdown, YAML 등)
- `vault.createBinary(path, arrayBuffer)`: 바이너리 파일 생성 (이미지, 비디오 등)
- `vault.createFolder(path)`: 폴더 생성 (recursive)
- `vault.modify(file, content)`: 기존 파일 수정
- `vault.process(file, callback)`: 안전한 파일 업데이트 (race condition 방지)
- `vault.getAbstractFileByPath(path)`: 파일/폴더 존재 확인

**Frontmatter Format**:
```yaml
---
platform: post
author:
  name: "User Display Name"
  handle: "@username"
  avatar: "vault-path-or-url"
timestamp: 2024-03-15T14:30:52Z
type: post
tags: [personal, thoughts, tech]
location: "Seoul, Korea"
mood: "😊"
privacy: public
share: true
shareUrl: "https://social-archive.junlim.org/username/abc123"
shareId: "abc123"
sharePassword: "optional-hash"
shareExpiry: 2024-04-14T14:30:52Z
linkPreviews:
  - url: "https://example.com"
    title: "Example Title"
    description: "Preview description"
    image: "preview-image-url"
mediaSourceUrls:
  - "vault://attachments/social-archives/post/2024-03-15/image1.png"
---
```

**Content Structure**:
```markdown
Post content here with **markdown** support.

Links are clickable: https://example.com

Obsidian [[links]] work too.

![[image-attachment.png]]
```

#### 6.2 Share API Integration

**Phase 1: Create Share (if share enabled)**
```typescript
POST /api/share
{
  postData: {
    platform: "post",
    id: "generated-uuid",
    url: "vault-path-to-note",
    author: { ... },
    content: {
      text: "...",
      markdown: "...",
      html: "..."
    },
    media: [...],
    metadata: {
      timestamp: "...",
      tags: [...]
    },
    linkPreviews: [...]
  },
  options: {
    username: "user-from-settings",
    password: "optional",
    expiry: 1234567890
  }
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    shareId: "abc123",
    shareUrl: "https://social-archive.junlim.org/username/abc123",
    expiresAt: 1234567890,
    passwordProtected: false
  }
}
```

#### 6.3 Credits System
- **기본 포스팅**: 0 credits (로컬 저장만)
- **Share 활성화**: 1 credit
- **Link preview generation**: 0 credits (캐시 활용)
- **AI 분석** (optional): 3 credits

### 7. **Component Architecture (SRP)**

```typescript
// src/components/composer/PostComposer.ts
import { App } from 'obsidian';

export class PostComposer {
  private containerEl: HTMLElement;
  private app: App;
  private isExpanded: boolean = false;

  constructor(containerEl: HTMLElement, app: App) {
    this.containerEl = containerEl;
    this.app = app;
    this.render();
  }

  // 메인 컴포저 컨테이너 관리
  // collapsed/expanded 상태 관리
  // DOM 이벤트 핸들링
}

// src/components/composer/MarkdownEditor.ts
export class MarkdownEditor {
  private editorEl: HTMLDivElement; // contenteditable div
  private content: string = '';

  constructor(parentEl: HTMLElement) {
    this.editorEl = parentEl.createDiv({ cls: 'post-editor' });
    this.editorEl.contentEditable = 'true';
    this.setupEventListeners();
  }

  // 텍스트 입력 처리
  // 링크 감지 (URL 패턴 매칭)
  // Character counting
  // Markdown syntax highlighting (optional)

  getContent(): string {
    return this.editorEl.innerText || this.editorEl.textContent || '';
  }

  setContent(content: string): void {
    this.editorEl.innerText = content;
  }
}

// src/components/composer/MediaAttacher.ts
import { Vault } from 'obsidian';

export class MediaAttacher {
  private vault: Vault;
  private attachedFiles: File[] = [];

  constructor(vault: Vault) {
    this.vault = vault;
  }

  // 이미지/비디오 첨부 처리
  // 드래그앤드롭 (drop event)
  // 파일 선택 (input[type="file"])
  // 붙여넣기 (paste event)

  async saveToVault(file: File, targetPath: string): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    await this.vault.createBinary(targetPath, arrayBuffer);
  }
}

// src/components/composer/MediaGrid.ts
export class MediaGrid {
  // 첨부된 미디어 그리드 렌더링
  // 순서 변경 (drag & drop)
  // 개별 삭제
  // Alt text 편집
  // vault.adapter.getResourcePath() 로 미리보기 이미지 표시
}

// src/components/composer/LinkPreviewGenerator.ts
export class LinkPreviewGenerator {
  // URL 자동 감지 (정규식)
  // Link preview API 호출 (기존 시스템 재사용)
  // Debounced fetch (2초 대기)
  // Preview card 렌더링
}

// src/components/composer/ShareOptions.ts
export class ShareOptions {
  // Share 설정 UI
  // Password, expiry, username
  // Toggle switches (Obsidian Setting components 활용)
}

// src/components/composer/PostPublisher.ts
import { Vault, TFile } from 'obsidian';

export class PostPublisher {
  private vault: Vault;

  async publishPost(postData: PostData): Promise<TFile> {
    // 1. Frontmatter + content 생성
    const content = this.generateMarkdown(postData);

    // 2. 파일 경로 결정
    const path = this.generateFilePath(postData);

    // 3. Vault에 저장
    const file = await this.vault.create(path, content);

    // 4. Share API 호출 (if enabled)
    if (postData.shareUrl) {
      await this.createShare(postData);
    }

    return file;
  }
}

// src/services/PostCreationService.ts
export class PostCreationService {
  // 포스트 생성 비즈니스 로직
  // PostData 객체 생성
  // Frontmatter YAML 생성
  // File path 결정 (날짜 기반)
  // Validation (길이, 포맷 등)
}

// src/services/VaultStorageService.ts
import { Vault, TFile, TFolder } from 'obsidian';

export class VaultStorageService {
  private vault: Vault;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  // Vault 저장/읽기/업데이트
  async ensureFolderExists(path: string): Promise<void> {
    const folder = this.vault.getAbstractFileByPath(path);
    if (!folder) {
      await this.vault.createFolder(path);
    }
  }

  async saveTextFile(path: string, content: string): Promise<TFile> {
    return await this.vault.create(path, content);
  }

  async saveBinaryFile(path: string, data: ArrayBuffer): Promise<TFile> {
    return await this.vault.createBinary(path, data);
  }

  // 미디어 파일 저장 (기존 MediaHandler 로직 재사용)
}
```

### 8. **Error Handling & Validation**

#### 8.1 Input Validation
- **Empty content**: "Please write something before posting"
- **Too long**: "Content exceeds 10,000 characters ({current}/10,000)"
- **Invalid image format**: "Unsupported image format. Use PNG, JPEG, GIF, or WebP"
- **File too large**: "Image exceeds 10MB limit"
- **Too many images**: "Maximum 10 images allowed"

#### 8.2 Network Errors
- **Share API failure**: Save locally first, show retry button
- **Link preview failure**: Continue without preview, show warning
- **Credits insufficient**: "Not enough credits to share. Upgrade to Pro?"

#### 8.3 Offline Support
- 항상 로컬 저장 우선
- Share는 optional (오프라인에서 draft로 저장)
- 온라인 복귀 시 자동 sync 옵션

### 9. **Security & Privacy**

#### 9.1 Local Data
- 모든 포스트는 사용자 Vault에 저장
- 민감 정보는 암호화 (password는 hash)
- Share 비활성화 시 완전히 로컬만

#### 9.2 Share Security
- Password: bcrypt hash (10 rounds)
- ShareId: Crypto-random 10자리 (기존 generateShareId 재사용)
- Expiry: UTC timestamp 검증
- Rate limiting: 1분당 10회 포스팅 제한

#### 9.3 Content Moderation (Optional - Phase 2)
- 욕설/스팸 필터 (client-side)
- 이미지 NSFW 검사 (optional, 3rd party API)

### 10. **Performance Optimization**

#### 10.1 Image Optimization
- 자동 리사이즈: 최대 2048x2048px
- WebP 변환 옵션 (설정에서 활성화)
- Lazy loading for previews
- Thumbnail 생성 (512x512px)

#### 10.2 Editor Performance
- Debounced link detection (500ms)
- Virtual scrolling for long posts
- Markdown rendering: cached HTML
- Media upload: parallel processing (max 3 concurrent)

#### 10.3 Caching
- Link previews: 캐시 30일 (KV Store)
- User avatar: local cache
- Draft auto-save: localStorage (1분마다)

### 11. **Testing Strategy**

#### 11.1 Unit Tests
```typescript
// PostCreationService.test.ts
- createPost() - PostData 객체 생성
- generateFrontmatter() - YAML 포맷 검증
- validateContent() - 입력 검증

// VaultStorageService.test.ts
- savePost() - 파일 저장
- getPostPath() - 경로 생성 로직

// MediaAttacher.test.ts
- attachImage() - 이미지 첨부
- validateFile() - 파일 검증
- resizeImage() - 리사이즈
```

#### 11.2 Integration Tests
- Composer + Editor + MediaAttacher 통합
- Share API 호출 흐름
- Offline -> Online sync

#### 11.3 E2E Tests (Obsidian Plugin Test)
- 타임라인 뷰에서 포스트 작성
- 이미지 첨부 및 게시
- Share URL 생성 및 접근

### 12. **Accessibility (a11y)**

- **Keyboard Navigation**: Tab order 최적화
- **Screen Reader**: ARIA labels 모든 컨트롤
- **High Contrast**: CSS variables 활용
- **Focus Indicators**: 모든 interactive 요소
- **Alt Text**: 이미지에 필수 alt text 입력 가이드

### 13. **i18n Support**

```typescript
const strings = {
  en: {
    composer: {
      placeholder: "What's on your mind?",
      addImages: "Add images",
      sharePublicly: "Share publicly",
      post: "Post",
      saveDraft: "Save Draft",
      characterCount: "{current}/{max} characters"
    }
  },
  ko: {
    composer: {
      placeholder: "무슨 생각을 하고 계신가요?",
      addImages: "이미지 추가",
      sharePublicly: "공개적으로 공유",
      post: "게시",
      saveDraft: "임시 저장",
      characterCount: "{current}/{max}자"
    }
  }
};
```

### 14. **Phase Implementation Plan**

#### Phase 1: MVP (Week 1-2)
- [ ] Basic composer UI (collapsed/expanded)
- [ ] Markdown editor integration (Obsidian native)
- [ ] Text input + character counter
- [ ] Image attachment (drag & drop, file picker)
- [ ] Local vault storage
- [ ] Basic share integration (no password/expiry)
- [ ] Timeline integration (post rendering)

#### Phase 2: Enhanced Features (Week 3-4)
- [ ] Link preview generation
- [ ] Share options (password, expiry)
- [ ] Draft auto-save
- [ ] Image optimization (resize, WebP)
- [ ] Media grid (reorder, alt text)
- [ ] Offline support + sync
- [ ] Credits system integration

#### Phase 3: Polish (Week 5)
- [ ] Mobile optimization
- [ ] Keyboard shortcuts
- [ ] Error handling refinement
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] i18n (English, Korean)

#### Phase 4: Advanced (Future)
- [ ] Video attachment
- [ ] AI content suggestions
- [ ] Scheduled posting
- [ ] Post analytics (views, likes)
- [ ] Comment system on shared posts
- [ ] Rich text formatting toolbar

### 15. **API Schema Updates**

#### 15.1 Update `Platform` type
```typescript
// workers/src/types/post.ts
export type Platform =
  | 'facebook'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'youtube'
  | 'reddit'
  | 'post'; // ✨ NEW
```

#### 15.2 Update PostData Schema
```typescript
// workers/src/types/api.ts
export const CreateShareRequestSchema = z.object({
  postData: z.any().optional(),
  content: z.string().optional(),
  metadata: z.object({
    // ... existing fields
    type: z.enum(['archive', 'post']).optional(), // ✨ NEW
    privacy: z.enum(['public', 'private', 'draft']).optional(), // ✨ NEW
  }).optional(),
  options: z.object({
    // ... existing options
  }).optional()
});
```

### 16. **Settings Integration**

추가 플러그인 설정:
```typescript
interface SocialArchiverSettings {
  // ... existing settings

  // Post Creation Settings
  postAuthorName: string;        // 사용자 표시 이름
  postAuthorHandle: string;      // @username
  postAuthorAvatar: string;      // 아바타 URL or vault path
  postDefaultPrivacy: 'public' | 'private' | 'draft';
  postAutoSave: boolean;         // Draft auto-save 활성화
  postAutoSaveInterval: number;  // Auto-save 간격 (초)
  postImageOptimization: boolean; // 이미지 최적화 활성화
  postMaxImageSize: number;      // MB 단위
  postDefaultShareExpiry: number | null; // 기본 공유 만료 (일)
}
```

### 17. **Database Schema (Share API)**

KV Store에 저장될 추가 데이터:
```typescript
// Key: `post:user:{username}:{postId}`
// Value:
{
  postId: "uuid-v4",
  type: "post",
  createdAt: 1710504123456,
  updatedAt: 1710504123456,
  author: {
    name: "...",
    handle: "@username",
    avatar: "..."
  },
  content: { ... },
  media: [ ... ],
  metadata: { ... },
  privacy: "public",
  shared: true,
  shareId: "abc123",
  stats: {
    views: 0,
    likes: 0, // Future feature
    comments: 0 // Future feature
  }
}
```

---

## 📊 Success Metrics

### KPI (Key Performance Indicators)
1. **Adoption Rate**: 사용자의 30%가 첫 주에 1회 이상 포스팅
2. **Engagement**: 작성된 포스트 중 50%가 share 활성화
3. **Retention**: 포스팅 기능 사용자의 월 활성 유지율 70%+
4. **Performance**: 포스트 작성 완료까지 평균 30초 이하
5. **Error Rate**: 포스트 작성 실패율 1% 이하

### User Feedback Targets
- Post creation experience: 4.5/5.0 stars
- Mobile usability: 4.0/5.0 stars
- Feature discoverability: 80% 사용자가 7일 내 발견

---

## 🚀 Launch Checklist

- [ ] Unit tests: 90% coverage
- [ ] Integration tests: Core flows 100%
- [ ] E2E tests: Critical paths
- [ ] Performance benchmarks: < 100ms interaction time
- [ ] Accessibility audit: WCAG 2.1 AA 준수
- [ ] Security review: OWASP Top 10 체크
- [ ] Mobile testing: iOS + Android
- [ ] Documentation: User guide + API docs
- [ ] Beta testing: 10명 이상 사용자 피드백
- [ ] Analytics setup: 사용 패턴 추적

---

## 📚 Obsidian API Reference Summary

### Core APIs Used

#### 1. **Vault API** (`this.app.vault`)
```typescript
import { Vault, TFile, TFolder, TAbstractFile } from 'obsidian';

// File operations
vault.create(path: string, content: string): Promise<TFile>
vault.createBinary(path: string, data: ArrayBuffer): Promise<TFile>
vault.createFolder(path: string): Promise<TFolder>
vault.modify(file: TFile, content: string): Promise<void>
vault.process(file: TFile, fn: (data: string) => string): Promise<string>
vault.delete(file: TAbstractFile): Promise<void>
vault.trash(file: TAbstractFile, system: boolean): Promise<void>

// Read operations
vault.read(file: TFile): Promise<string>
vault.cachedRead(file: TFile): Promise<string>
vault.readBinary(file: TFile): Promise<ArrayBuffer>

// Query operations
vault.getMarkdownFiles(): TFile[]
vault.getFiles(): TFile[]
vault.getAbstractFileByPath(path: string): TAbstractFile | null

// Adapter (low-level file system)
vault.adapter.getResourcePath(path: string): string
vault.adapter.exists(path: string): Promise<boolean>
```

#### 2. **Platform Detection** (`Platform`)
```typescript
import { Platform } from 'obsidian';

Platform.isMobile: boolean       // iOS or Android
Platform.isIosApp: boolean
Platform.isAndroidApp: boolean
Platform.isDesktopApp: boolean
Platform.isMacOS: boolean
Platform.isWin: boolean
Platform.isLinux: boolean
```

#### 3. **App Instance** (`this.app`)
```typescript
import { App } from 'obsidian';

app.vault: Vault                 // Vault API
app.workspace: Workspace         // UI workspace
app.metadataCache: MetadataCache // File metadata
app.fileManager: FileManager     // File operations

// Mobile emulation (for testing)
app.emulateMobile(enabled: boolean): void
app.isMobile: boolean
```

#### 4. **Views** (Timeline View)
```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';

export class TimelineView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return 'timeline-view'; }
  getDisplayText(): string { return 'Timeline'; }
  getIcon(): string { return 'calendar-clock'; }

  async onOpen(): Promise<void> {
    // Build view content
    const container = this.containerEl;
    container.empty();
    // ... render composer
  }

  async onClose(): Promise<void> {
    // Cleanup resources
  }
}
```

#### 5. **HTML Elements** (DOM API)
```typescript
// Obsidian HTMLElement extensions
containerEl.createEl(tag: string, options?: DomElementInfo): HTMLElement
containerEl.createDiv(options?: DomElementInfo): HTMLDivElement
containerEl.createSpan(options?: DomElementInfo): HTMLSpanElement
containerEl.empty(): void

// Example
const div = containerEl.createDiv({
  cls: 'post-composer',
  attr: { 'data-expanded': 'false' }
});
```

#### 6. **Settings** (UI Components)
```typescript
import { Setting } from 'obsidian';

new Setting(containerEl)
  .setName('Share publicly')
  .setDesc('Allow others to view this post')
  .addToggle(toggle => toggle
    .setValue(false)
    .onChange(value => {
      // Handle change
    }));

new Setting(containerEl)
  .setName('Post content')
  .addTextArea(text => text
    .setPlaceholder('What\'s on your mind?')
    .onChange(value => {
      // Handle change
    }));
```

### Important Constraints

1. **Mobile Limitations**:
   - No Node.js API (fs, path, etc.)
   - No Electron API
   - Limited regex features (lookbehind iOS 16.4+)
   - Use `Platform.isMobile` to conditionally enable features

2. **Editor API**:
   - `Editor` class only works with `MarkdownView`
   - Custom views (like Timeline) must use DOM directly
   - Use `contenteditable` div or `<textarea>` for text input
   - Cannot reuse Obsidian's native markdown editor in custom views

3. **File Paths**:
   - All paths are relative to vault root
   - Use forward slashes `/` (even on Windows)
   - Vault API handles path normalization
   - Check folder existence before creating files

4. **Async Operations**:
   - All Vault operations are async (return Promise)
   - Use `vault.process()` for safe read-modify-write
   - Avoid race conditions with concurrent file writes

5. **Type Checking**:
   ```typescript
   const fileOrFolder = vault.getAbstractFileByPath(path);
   if (fileOrFolder instanceof TFile) {
     // It's a file
   } else if (fileOrFolder instanceof TFolder) {
     // It's a folder
   }
   ```

### Testing

```typescript
// Enable mobile emulation
this.app.emulateMobile(true);

// Check if mobile mode is active
if (this.app.isMobile) {
  console.log('Mobile mode active');
}

// Toggle mobile mode
this.app.emulateMobile(!this.app.isMobile);
```

### Documentation References

- **Official Docs**: `/Users/hyungyunlim/obsidian-social-archiver/reference/obsidian-developer-docs/en/`
- **Vault API**: `Plugins/Vault.md`
- **Editor API**: `Plugins/Editor/Editor.md`
- **Views**: `Plugins/User interface/Views.md`
- **Mobile**: `Plugins/Getting started/Mobile development.md`
- **Modals**: `Plugins/User interface/Modals.md`
- **TypeScript API**: `Reference/TypeScript API/`

---

## 📝 Notes

- 이 스펙은 MVP 기준으로 작성되었으며, 사용자 피드백에 따라 조정 가능
- **Obsidian API 제약사항 확인 완료**:
  - Custom views에서 Editor API 직접 사용 불가 → contenteditable div 사용
  - Mobile에서 Node.js/Electron API 사용 금지 → Platform.isMobile 체크
  - Vault API로 파일/폴더 생성/수정 가능 → `vault.create()`, `vault.createBinary()` 사용
- Share API는 기존 시스템 재사용으로 빠른 구현 가능
- Timeline 렌더링은 기존 PostCard 컴포넌트 재사용 (`platform: 'post'` 추가)
- 모든 파일 작업은 Vault API를 통해 수행하여 Obsidian 파일 감시자와 호환
