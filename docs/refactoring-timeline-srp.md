# Timeline View Refactoring Plan - SRP (Single Responsibility Principle)

## 📊 진행 상황 (2025-01-29)

### ✅ 완료된 작업

#### Phase 1: Parser 분리 (완료)
- ✅ `PostDataParser.ts` (286줄) - 데이터 파싱 로직
- Commit: ecf5e0a

#### Phase 2: Filter/Sort 분리 (완료)
- ✅ `FilterSortManager.ts` (175줄) - 필터/정렬 로직
- ✅ `FilterPanel.ts` (327줄) - 필터 UI
- ✅ `SortDropdown.ts` (263줄) - 정렬 UI
- Commit: 4e508f9

#### Phase 3: Renderer 분리 (완료) ✅
- ✅ `MediaGalleryRenderer.ts` (218줄) - 미디어 갤러리 렌더링 (Commit: b484df1)
- ✅ `CommentRenderer.ts` (168줄) - 댓글 렌더링 (Commit: 38f8e86)
- ✅ `YouTubeEmbedRenderer.ts` (75줄) - YouTube/TikTok 임베드 (Commit: 69a46bb)
- ✅ `PostCardRenderer.ts` (966줄) - 포스트 카드 렌더링 (Commit: e96559c)

#### Phase 4: Controller 분리 (완료) ✅
- ✅ `YouTubePlayerController.ts` (67줄) - YouTube iframe 제어 (Phase 4 완료)

### 📉 TimelineContainer.ts 축소 현황
```
시작:  1762줄 (Phase 0)
Phase 1: -286줄 → 1476줄 (파서 분리)
Phase 2: -533줄 → 1760줄 → 1464줄 (필터/정렬 분리, 헤더 리팩토링)
Phase 3.1: -191줄 → 1571줄 (MediaGalleryRenderer)
Phase 3.2: -107줄 → 1464줄 (CommentRenderer)
Phase 3.3: -64줄 → 1400줄 (YouTubeEmbedRenderer)
Phase 3.4: -615줄 → 798줄 (PostCardRenderer)
Cleanup: -249줄 → 549줄 (미사용 메서드 제거, TypeScript strict 적용)
Phase 4: -30줄 → 519줄 (YouTubePlayerController)

현재: 519줄 (-1243줄, -70.5% 감소) ✅
목표: ~200줄 (Phase 5 완료 후)

✨ TypeScript strict mode 통과
✨ 빌드 사이즈 최적화: 7.46 MB → 7.44 MB
```

### 🎯 남은 작업
- ⏳ Phase 5: 테스트 작성

---

## 현재 문제점

### TimelineContainer.ts (1600+ lines)
현재 `TimelineContainer.ts` 파일이 너무 많은 책임을 가지고 있습니다:

1. **데이터 로딩 및 파싱** - YAML frontmatter 파싱, 마크다운 컨텐츠 추출
2. **필터링 및 정렬** - 플랫폼/좋아요/날짜 필터, 정렬 로직
3. **UI 렌더링** - 포스트 카드, 미디어 갤러리, 댓글, 필터 패널, 정렬 드롭다운
4. **이벤트 처리** - 클릭, 호버, 키보드 네비게이션
5. **YouTube 플레이어 제어** - postMessage API 통신
6. **상태 관리** - 포스트 목록, 필터 상태, 드롭다운 상태

**SRP 위반**: 한 파일에 너무 많은 책임이 집중되어 있어 유지보수와 테스트가 어렵습니다.

## 리팩토링 목표

```typescript
// CLAUDE_MEMORIZE.md 원칙 준수
export class ArchiveService {
  // API 통신만 담당
}

export class MarkdownConverter {
  // 마크다운 변환만 담당
}

export class MediaHandler {
  // 미디어 처리만 담당
}

export class VaultManager {
  // Vault 작업만 담당
}
```

## 제안하는 새로운 구조

```
src/components/timeline/
├── TimelineContainer.ts              # 메인 컨테이너 (조율만, 519줄) ✅
│   └── 역할: 생명주기 관리, 컴포넌트 조립, 전체 조율
│
├── controllers/
│   └── YouTubePlayerController.ts    # YouTube iframe 제어 (67줄) ✅
│       └── 역할: postMessage API를 통한 YouTube 플레이어 제어
│
├── renderers/
│   ├── PostCardRenderer.ts           # 포스트 카드 렌더링 (~400줄)
│   │   └── 역할: 포스트 카드 HTML 생성, 인터랙션 이벤트
│   │
│   ├── MediaGalleryRenderer.ts       # 미디어 갤러리 렌더링 (~300줄)
│   │   └── 역할: 이미지/비디오 갤러리, 캐러셀 네비게이션
│   │
│   ├── CommentRenderer.ts            # 댓글 렌더링 (~200줄)
│   │   └── 역할: 댓글 트리 구조, nested 댓글 표시
│   │
│   └── YouTubeEmbedRenderer.ts       # YouTube 임베드 렌더링 (~100줄)
│       └── 역할: YouTube iframe 생성, 타임스탬프 링크
│
├── filters/
│   ├── FilterPanel.ts                # 필터 패널 UI (~200줄)
│   │   └── 역할: 플랫폼/좋아요/아카이브 필터 UI, 이벤트 처리
│   │
│   ├── SortDropdown.ts               # 정렬 드롭다운 UI (~150줄)
│   │   └── 역할: 정렬 옵션 UI, 정렬 변경 이벤트
│   │
│   └── FilterSortManager.ts          # 필터/정렬 로직 (~150줄)
│       └── 역할: 필터링 알고리즘, 정렬 알고리즘, 상태 관리
│
├── parsers/
│   ├── PostDataParser.ts             # 포스트 데이터 파싱 (~300줄)
│   │   └── 역할: YAML frontmatter 파싱, 마크다운 컨텐츠 추출
│   │
│   └── MarkdownLinkParser.ts         # 마크다운 링크 파싱 (~150줄)
│       └── 역할: 링크 감지, YouTube 타임스탬프 추출
│
└── utils/
    ├── DateGrouper.ts                # 날짜 그룹핑 (~100줄)
    │   └── 역할: Today, Yesterday, This Week 등 그룹핑
    │
    └── NumberFormatter.ts            # 숫자 포맷팅 (~50줄)
        └── 역할: 1000 → 1K, 1000000 → 1M 변환
```

## 클래스별 책임 상세

### 1. TimelineContainer.ts (메인 컨테이너)
```typescript
export class TimelineContainer {
  private postDataParser: PostDataParser;
  private filterSortManager: FilterSortManager;
  private postCardRenderer: PostCardRenderer;
  private filterPanel: FilterPanel;
  private sortDropdown: SortDropdown;

  constructor(target: HTMLElement, props: TimelineContainerProps) {
    // 의존성 주입
    this.postDataParser = new PostDataParser(props.vault, props.app);
    this.filterSortManager = new FilterSortManager();
    this.postCardRenderer = new PostCardRenderer(props.vault, props.app, props.plugin);
    this.filterPanel = new FilterPanel();
    this.sortDropdown = new SortDropdown();
  }

  async loadPosts(): Promise<void> {
    // 1. 데이터 로드 (Parser에게 위임)
    const posts = await this.postDataParser.loadFromVault(this.archivePath);

    // 2. 필터/정렬 (FilterSortManager에게 위임)
    const filtered = this.filterSortManager.applyFiltersAndSort(posts);

    // 3. 렌더링 (Renderer에게 위임)
    this.renderPosts(filtered);
  }

  private renderHeader(): void {
    // FilterPanel과 SortDropdown을 헤더에 마운트
    this.filterPanel.mount(this.headerEl);
    this.sortDropdown.mount(this.headerEl);
  }

  private renderPosts(posts: PostData[]): void {
    posts.forEach(post => {
      this.postCardRenderer.render(this.feedEl, post);
    });
  }
}
```

### 2. PostDataParser.ts (데이터 파싱)
```typescript
export class PostDataParser {
  constructor(
    private vault: Vault,
    private app: App
  ) {}

  async loadFromVault(archivePath: string): Promise<PostData[]> {
    const files = this.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith(archivePath));

    const posts = await Promise.all(
      files.map(file => this.parseFile(file))
    );

    return posts.filter(post => post !== null) as PostData[];
  }

  private async parseFile(file: TFile): Promise<PostData | null> {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter as YamlFrontmatter | undefined;

    if (!frontmatter || !frontmatter.platform) {
      return null;
    }

    const content = await this.vault.read(file);

    return {
      platform: frontmatter.platform,
      // ... 파싱 로직
    };
  }

  extractContentText(markdown: string): string { /* ... */ }
  extractMetadata(markdown: string): PostMetadata { /* ... */ }
  extractMedia(markdown: string): string[] { /* ... */ }
  extractComments(markdown: string): Comment[] { /* ... */ }
}
```

### 3. FilterSortManager.ts (필터/정렬 로직)
```typescript
export interface FilterState {
  platforms: Set<string>;
  likedOnly: boolean;
  includeArchived: boolean;
  dateRange: { start: Date | null; end: Date | null };
}

export interface SortState {
  by: 'published' | 'archived';
  order: 'newest' | 'oldest';
}

export class FilterSortManager {
  private filterState: FilterState = { /* defaults */ };
  private sortState: SortState = { /* defaults */ };

  applyFiltersAndSort(posts: PostData[]): PostData[] {
    let filtered = this.applyFilters(posts);
    let sorted = this.applySort(filtered);
    return sorted;
  }

  private applyFilters(posts: PostData[]): PostData[] {
    return posts.filter(post => {
      // 플랫폼 필터
      if (!this.filterState.platforms.has(post.platform)) return false;

      // 좋아요 필터
      if (this.filterState.likedOnly && !post.like) return false;

      // 아카이브 필터
      if (!this.filterState.includeArchived && post.archive) return false;

      return true;
    });
  }

  private applySort(posts: PostData[]): PostData[] {
    return posts.sort((a, b) => {
      // 좋아요 우선
      if (a.like !== b.like) return a.like ? -1 : 1;

      // 날짜 정렬
      const getDate = (post: PostData) =>
        this.sortState.by === 'published'
          ? post.publishedDate
          : post.archivedDate;

      const aTime = getDate(a)?.getTime() ?? 0;
      const bTime = getDate(b)?.getTime() ?? 0;

      return this.sortState.order === 'newest'
        ? bTime - aTime
        : aTime - bTime;
    });
  }

  updateFilter(filter: Partial<FilterState>): void { /* ... */ }
  updateSort(sort: Partial<SortState>): void { /* ... */ }
  getFilterState(): FilterState { return this.filterState; }
  getSortState(): SortState { return this.sortState; }
}
```

### 4. PostCardRenderer.ts (포스트 카드 렌더링)
```typescript
export class PostCardRenderer {
  private mediaGalleryRenderer: MediaGalleryRenderer;
  private commentRenderer: CommentRenderer;
  private youtubeEmbedRenderer: YouTubeEmbedRenderer;

  constructor(
    private vault: Vault,
    private app: App,
    private plugin: SocialArchiverPlugin
  ) {
    this.mediaGalleryRenderer = new MediaGalleryRenderer();
    this.commentRenderer = new CommentRenderer();
    this.youtubeEmbedRenderer = new YouTubeEmbedRenderer();
  }

  render(container: HTMLElement, post: PostData): void {
    const card = this.createCard(container, post);

    this.renderHeader(card, post);
    this.renderContent(card, post);

    if (post.media.length > 0) {
      this.mediaGalleryRenderer.render(card, post.media);
    }

    if (post.videoId) {
      this.youtubeEmbedRenderer.render(card, post.videoId);
    }

    if (post.comments) {
      this.commentRenderer.render(card, post.comments);
    }

    this.renderInteractions(card, post);
  }

  private createCard(container: HTMLElement, post: PostData): HTMLElement { /* ... */ }
  private renderHeader(card: HTMLElement, post: PostData): void { /* ... */ }
  private renderContent(card: HTMLElement, post: PostData): void { /* ... */ }
  private renderInteractions(card: HTMLElement, post: PostData): void { /* ... */ }
}
```

### 5. FilterPanel.ts (필터 UI)
```typescript
export class FilterPanel {
  private panelEl: HTMLElement | null = null;
  private isOpen = false;
  private onFilterChange?: (filter: Partial<FilterState>) => void;

  mount(parent: HTMLElement): void {
    const button = this.createButton(parent);
    button.addEventListener('click', () => this.toggle());
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.panelEl = this.createPanel();
    this.renderPlatformFilters();
    this.renderLikeFilter();
    this.renderArchiveFilter();
    this.attachOutsideClickHandler();
  }

  private close(): void {
    this.panelEl?.remove();
    this.panelEl = null;
    this.isOpen = false;
  }

  setFilterState(state: FilterState): void { /* ... */ }

  onFilterChanged(callback: (filter: Partial<FilterState>) => void): void {
    this.onFilterChange = callback;
  }
}
```

### 6. YouTubePlayerController.ts (YouTube 제어)
```typescript
export class YouTubePlayerController {
  private iframe: HTMLIFrameElement;
  private ready = false;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.iframe.addEventListener('load', () => {
      this.ready = true;
      this.sendCommand('listening');
    });
  }

  private sendCommand(func: string, args: any[] = []): void {
    if (!this.ready) return;

    const message = JSON.stringify({
      event: func === 'listening' ? 'listening' : 'command',
      func: func === 'listening' ? undefined : func,
      args
    });

    this.iframe.contentWindow?.postMessage(message, '*');
  }

  seekTo(seconds: number): void {
    this.sendCommand('seekTo', [seconds, true]);
  }

  play(): void { this.sendCommand('playVideo'); }
  pause(): void { this.sendCommand('pauseVideo'); }
  mute(): void { this.sendCommand('mute'); }
  unmute(): void { this.sendCommand('unMute'); }
}
```

## 리팩토링 이점

### 1. 테스트 가능성 ✅
```typescript
// 각 클래스를 독립적으로 테스트 가능
describe('FilterSortManager', () => {
  it('should filter liked posts', () => {
    const manager = new FilterSortManager();
    manager.updateFilter({ likedOnly: true });
    const filtered = manager.applyFiltersAndSort(mockPosts);
    expect(filtered.every(p => p.like)).toBe(true);
  });
});

describe('PostDataParser', () => {
  it('should parse YAML frontmatter correctly', async () => {
    const parser = new PostDataParser(mockVault, mockApp);
    const post = await parser.parseFile(mockFile);
    expect(post.platform).toBe('linkedin');
  });
});
```

### 2. 재사용 가능성 🔄
```typescript
// FilterSortManager를 다른 뷰에서도 사용 가능
export class SearchView {
  private filterManager = new FilterSortManager();
  // 동일한 필터/정렬 로직 재사용
}

// PostDataParser를 아카이브 기능에서도 사용
export class ArchiveService {
  private parser = new PostDataParser(vault, app);
  // 동일한 파싱 로직 재사용
}
```

### 3. 유지보수 용이성 🛠️
```typescript
// 버그 수정 시 해당 파일만 수정
// 예: 댓글 렌더링 버그 → CommentRenderer.ts만 수정
// 예: 정렬 로직 버그 → FilterSortManager.ts만 수정

// 파일이 작아서 코드 이해 및 수정이 쉬움
// TimelineContainer.ts: 1600줄 → 200줄
```

### 4. 가독성 📖
```typescript
// 명확한 파일명으로 코드 찾기 쉬움
// "YouTube 플레이어 제어" → YouTubePlayerController.ts
// "필터 패널 UI" → FilterPanel.ts
// "마크다운 파싱" → PostDataParser.ts

// 각 파일이 하나의 목적만 가지므로 이해하기 쉬움
```

### 5. 의존성 주입 💉
```typescript
// 테스트 시 목(Mock) 객체 주입 가능
const mockParser = {
  loadFromVault: jest.fn().mockResolvedValue(mockPosts)
};

const container = new TimelineContainer(
  el,
  { parser: mockParser } // 의존성 주입
);
```

## 리팩토링 단계별 계획

### Phase 1: 파서 분리 (낮은 위험)
1. `PostDataParser.ts` 생성
2. 파싱 관련 메서드 이동
3. `TimelineContainer`에서 사용
4. 테스트 작성

### Phase 2: 필터/정렬 분리
1. `FilterSortManager.ts` 생성
2. 필터/정렬 로직 이동
3. `FilterPanel.ts`, `SortDropdown.ts` 생성
4. UI 로직 분리

### Phase 3: 렌더러 분리
1. `PostCardRenderer.ts` 생성
2. `MediaGalleryRenderer.ts` 분리
3. `CommentRenderer.ts` 분리
4. `YouTubeEmbedRenderer.ts` 분리

### Phase 4: 컨트롤러 분리
1. `YouTubePlayerController.ts` 독립 파일로 이동
2. 유틸리티 함수들 분리

### Phase 5: 테스트 작성
1. 각 클래스별 단위 테스트
2. 통합 테스트
3. E2E 테스트

## 예상 파일 크기
```
TimelineContainer.ts:       1600줄 → 200줄  (-87%)
PostDataParser.ts:            0줄 → 300줄  (신규)
FilterSortManager.ts:         0줄 → 150줄  (신규)
PostCardRenderer.ts:          0줄 → 400줄  (신규)
MediaGalleryRenderer.ts:      0줄 → 300줄  (신규)
CommentRenderer.ts:           0줄 → 200줄  (신규)
YouTubeEmbedRenderer.ts:      0줄 → 100줄  (신규)
FilterPanel.ts:               0줄 → 200줄  (신규)
SortDropdown.ts:              0줄 → 150줄  (신규)
YouTubePlayerController.ts:   0줄 →  80줄  (신규)
-------------------------------------------
Total:                      1600줄 → 2080줄

- 코드 양은 증가하지만 각 파일이 작고 명확함
- 테스트 코드 작성 가능 (현재는 불가능)
- 유지보수 비용 대폭 감소
```

## 결론

현재 구조는 작동하지만 **SRP 원칙**을 위반하여 장기적으로 유지보수가 어려워질 수 있습니다.

리팩토링을 통해:
- ✅ 각 클래스가 단일 책임만 가짐
- ✅ 테스트 가능한 코드
- ✅ 재사용 가능한 컴포넌트
- ✅ 명확한 코드 구조
- ✅ 쉬운 버그 수정

**권장사항**: 새 기능 추가 전에 리팩토링을 진행하여 기술 부채를 줄이는 것이 좋습니다.

---

**작성일**: 2025-01-29
**작성자**: Claude Code
**목적**: Timeline View SRP 리팩토링 계획 문서화
