# MetadataCache 활용 대규모 포스트 스케일링 최적화

## 📋 개요

수천~수만 개의 아카이브된 포스트를 효율적으로 처리하기 위한 Obsidian 네이티브 API 기반 최적화 전략 문서.

**핵심 원칙**: 별도 DB 없이 Obsidian의 MetadataCache를 최대한 활용하여 성능 개선

---

## 🔴 현재 문제점 분석

### PostDataParser.ts 비효율성

**위치**: `src/components/timeline/parsers/PostDataParser.ts`

```typescript
// 현재 구현 (Lines 17-43)
async loadFromVault(archivePath: string): Promise<PostData[]> {
  const allFiles = this.vault.getMarkdownFiles(); // ✅ OK

  for (const file of archiveFiles) {
    const content = await this.vault.read(file);  // ❌ 모든 파일 직접 읽기
    const frontmatter = this.parseFrontmatter(content); // ❌ 수동 파싱
  }
}
```

### 문제점 상세

1. **디스크 I/O 과다**
   - `vault.read(file)` 사용 → 캐시 미활용
   - 10,000개 파일 × 평균 50KB = 500MB 메모리 사용
   - 디스크 읽기 10,000회 → 5-10초 소요

2. **수동 frontmatter 파싱**
   - Obsidian이 이미 `MetadataCache`에 파싱해둠
   - 중복 파싱으로 CPU 낭비

3. **MetadataCache 미활용**
   - `app.metadataCache.getFileCache(file)` 사용 안 함
   - 메모리 캐시된 메타데이터 무시

4. **전체 콘텐츠 메모리 로드**
   - 필터링/정렬에는 frontmatter만 필요
   - 불필요한 전체 파일 읽기

### 성능 측정 (10,000 파일 기준)

| 지표 | 현재 구현 | 목표 |
|------|----------|------|
| 로딩 시간 | ~8초 | ~1초 |
| 메모리 사용 | 500MB | 100MB |
| 디스크 I/O | 10,000회 읽기 | ~100회 읽기 (캐시된 경우 0회) |

---

## ✅ 해결 방안: MetadataCache 활용

### Obsidian MetadataCache API

**참고 문서**: `reference/obsidian-developer-docs/en/Reference/TypeScript API/MetadataCache.md`

```typescript
interface CachedMetadata {
  frontmatter?: Record<string, any>; // ✅ 이미 파싱된 YAML
  tags?: { tag: string; position: Position }[]; // ✅ 태그 인덱스
  links?: { link: string; position: Position }[]; // ✅ 링크 인덱스
  embeds?: { link: string; position: Position }[]; // ✅ 임베드 인덱스
  headings?: HeadingCache[];
  // ...
}
```

**주요 메서드**:
- `metadataCache.getFileCache(file)` - 파일의 캐시된 메타데이터 반환
- `vault.cachedRead(file)` - 캐시된 파일 내용 반환

### 최적화 전략

#### 1. Frontmatter는 MetadataCache에서만 가져오기

```typescript
// ❌ 기존 방식
const content = await this.vault.read(file);
const frontmatter = this.parseFrontmatter(content);

// ✅ 개선 방식
const cache = this.app.metadataCache.getFileCache(file);
const frontmatter = cache?.frontmatter; // 이미 파싱됨!
```

**성능 개선**:
- 디스크 I/O 제거
- 파싱 CPU 시간 제거
- 즉각적인 메모리 액세스

#### 2. 콘텐츠는 필요한 경우에만 cachedRead() 사용

```typescript
// ❌ 기존 방식
const content = await this.vault.read(file); // 항상 디스크 읽기

// ✅ 개선 방식
const content = await this.vault.cachedRead(file); // 캐시 우선
```

**Vault.md 문서에서**:
> `cachedRead()` - 사용자에게 콘텐츠를 표시할 때 사용. 디스크에서 여러 번 읽지 않음.
> `read()` - 콘텐츠를 변경하고 다시 저장할 때만 사용.

#### 3. 미디어는 cache.embeds에서 추출

```typescript
// ❌ 기존 방식
const markdown = await vault.read(file);
const mediaUrls = this.extractMedia(markdown); // 정규식 파싱

// ✅ 개선 방식
const cache = this.app.metadataCache.getFileCache(file);
const mediaUrls = cache.embeds?.map(e => e.link) || [];
```

**성능 개선**:
- 정규식 파싱 제거
- Obsidian이 이미 인덱싱한 데이터 활용

---

## 🎯 구현 가이드

### Phase 1: PostDataParser 리팩토링

**파일**: `src/components/timeline/parsers/PostDataParser.ts`

#### 변경 사항

1. **constructor에 App 추가**
```typescript
constructor(
  private vault: Vault,
  private app: App // MetadataCache 접근용
) {}
```

2. **loadFromVault 메서드 최적화**

```typescript
async loadFromVault(archivePath: string): Promise<PostData[]> {
  const allFiles = this.vault.getMarkdownFiles();
  const archiveFiles = allFiles.filter(file =>
    file.path.startsWith(archivePath)
  );

  const loadedPosts: PostData[] = [];

  for (const file of archiveFiles) {
    try {
      // ✅ MetadataCache에서 frontmatter 가져오기
      const cache = this.app.metadataCache.getFileCache(file);

      if (!cache?.frontmatter || !cache.frontmatter.platform) {
        continue;
      }

      // ✅ cachedRead()로 콘텐츠 읽기
      const content = await this.vault.cachedRead(file);

      const postData = this.createPostDataFromCache(
        file,
        cache.frontmatter,
        content,
        cache
      );

      if (postData) {
        loadedPosts.push(postData);
      }
    } catch (err) {
      console.warn(`Failed to load ${file.path}:`, err);
    }
  }

  return loadedPosts;
}
```

3. **새 메서드 추가: createPostDataFromCache**

```typescript
private createPostDataFromCache(
  file: TFile,
  frontmatter: Record<string, any>,
  content: string,
  cache: CachedMetadata
): PostData | null {
  const platform = frontmatter.platform;

  // User post 검증
  if (platform === 'post' && !this.validateUserPost(frontmatter)) {
    return null;
  }

  // ✅ cache.embeds로 미디어 확인
  const mediaUrls = this.extractMediaFromCache(cache);

  // Content 추출 (한 번만 파싱)
  const contentText = this.extractContentText(content);
  const metadata = this.extractMetadata(content);

  return {
    platform: platform as any,
    id: file.basename,
    url: platform === 'post' ? file.path : (frontmatter.originalUrl || ''),
    filePath: file.path,
    // ✅ frontmatter 값 직접 사용
    comment: frontmatter.comment,
    like: frontmatter.like,
    archive: frontmatter.archive,
    shareUrl: frontmatter.shareUrl,
    publishedDate: frontmatter.published ? new Date(frontmatter.published) : undefined,
    archivedDate: frontmatter.archived ? new Date(frontmatter.archived) : undefined,
    author: {
      name: frontmatter.author || 'Unknown',
      url: frontmatter.authorUrl || '',
      avatar: frontmatter.authorAvatar,
      handle: frontmatter.authorHandle,
    },
    content: { text: contentText },
    media: mediaUrls.map(url => ({ type: 'image' as const, url })),
    metadata: {
      timestamp: new Date(frontmatter.published || frontmatter.archived || file.stat.ctime),
      likes: frontmatter.likes ?? metadata.likes,
      comments: frontmatter.comments ?? metadata.comments,
      shares: frontmatter.shares ?? metadata.shares,
      views: frontmatter.views ?? metadata.views,
    },
  };
}
```

4. **새 메서드 추가: extractMediaFromCache**

```typescript
private extractMediaFromCache(cache: CachedMetadata): string[] {
  const mediaUrls: string[] = [];

  // ✅ cache.embeds 활용 (이미 파싱됨!)
  if (cache.embeds) {
    for (const embed of cache.embeds) {
      const link = embed.link;
      // Vault 내부 링크만
      if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
        mediaUrls.push(link);
      }
    }
  }

  return mediaUrls;
}
```

5. **parseFrontmatter 메서드 제거**
   - 더 이상 필요 없음 (MetadataCache 사용)

#### TimelineContainer.ts 수정

```typescript
// Line 74
this.postDataParser = new PostDataParser(this.vault, this.app);
```

---

### Phase 2: PostIndexCache 서비스 추가

**새 파일**: `src/services/PostIndexCache.ts`

플랫폼별, 날짜별 빠른 필터링을 위한 인덱스 캐시.

```typescript
import { App, TFile } from 'obsidian';

export class PostIndexCache {
  private app: App;

  // 플랫폼별 인덱스 (메모리 캐시)
  private postsByPlatform = new Map<string, TFile[]>();
  private lastIndexTime = new Map<string, number>();

  // TTL: 5분
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(app: App) {
    this.app = app;
    this.setupEventListeners();
  }

  /**
   * MetadataCache 이벤트로 자동 갱신
   */
  private setupEventListeners() {
    // frontmatter 변경 감지
    this.app.metadataCache.on('changed', (file) => {
      this.invalidateCacheForFile(file);
    });

    // 파일 삭제 시 캐시 무효화
    this.app.vault.on('delete', () => {
      this.invalidateAllCaches();
    });
  }

  /**
   * 플랫폼별 포스트 가져오기 (캐시됨)
   */
  getPostsByPlatform(platform: string, archivePath: string): TFile[] {
    const cacheKey = `${platform}_${archivePath}`;
    const cached = this.postsByPlatform.get(cacheKey);
    const lastUpdate = this.lastIndexTime.get(cacheKey);

    // 캐시 유효성 확인
    if (cached && lastUpdate && Date.now() - lastUpdate < this.CACHE_TTL) {
      return cached;
    }

    // 재인덱싱
    return this.reindexPlatform(platform, archivePath, cacheKey);
  }

  private reindexPlatform(platform: string, archivePath: string, cacheKey: string): TFile[] {
    const allFiles = this.app.vault.getMarkdownFiles();
    const filtered: TFile[] = [];

    for (const file of allFiles) {
      if (!file.path.startsWith(archivePath)) continue;

      // ✅ MetadataCache에서 플랫폼 확인
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.platform === platform) {
        filtered.push(file);
      }
    }

    this.postsByPlatform.set(cacheKey, filtered);
    this.lastIndexTime.set(cacheKey, Date.now());

    return filtered;
  }

  private invalidateCacheForFile(file: TFile) {
    // 파일이 속한 플랫폼 캐시만 무효화
    const cache = this.app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.platform) {
      const platform = cache.frontmatter.platform;
      // 해당 플랫폼 캐시 제거
      for (const key of this.postsByPlatform.keys()) {
        if (key.startsWith(platform + '_')) {
          this.postsByPlatform.delete(key);
          this.lastIndexTime.delete(key);
        }
      }
    }
  }

  private invalidateAllCaches() {
    this.postsByPlatform.clear();
    this.lastIndexTime.clear();
  }
}
```

---

### Phase 3: 가상 스크롤링 (선택적)

**참고**: `reference/obsidian-developer-docs/en/Plugins/Guides/Understanding deferred views.md`

Obsidian v1.7.2+의 Deferred Views 활용하여 렌더링 성능 개선.

#### 가상 스크롤 컴포넌트

**새 파일**: `src/components/timeline/VirtualScrollTimeline.ts`

```typescript
export class VirtualScrollTimeline {
  private containerEl: HTMLElement;
  private posts: TFile[] = [];
  private visiblePosts: TFile[] = [];

  private scrollTop = 0;
  private containerHeight = 0;

  private readonly ITEM_HEIGHT = 400; // 평균 포스트 카드 높이
  private readonly BUFFER_SIZE = 3; // 버퍼 아이템 수
  private readonly BATCH_SIZE = 20; // 한 번에 로드할 개수

  constructor(container: HTMLElement) {
    this.containerEl = container;
    this.setupScrollListener();
  }

  private setupScrollListener() {
    this.containerEl.addEventListener('scroll', () => {
      this.scrollTop = this.containerEl.scrollTop;
      this.updateVisibleRange();
      this.checkLoadMore();
    });
  }

  private updateVisibleRange() {
    const start = Math.max(0, Math.floor(this.scrollTop / this.ITEM_HEIGHT) - this.BUFFER_SIZE);
    const count = Math.ceil(this.containerHeight / this.ITEM_HEIGHT) + this.BUFFER_SIZE * 2;
    const end = Math.min(this.posts.length, start + count);

    this.visiblePosts = this.posts.slice(start, end);
    this.render();
  }

  private checkLoadMore() {
    const scrollBottom = this.containerEl.scrollHeight - this.scrollTop - this.containerHeight;

    if (scrollBottom < 1000) {
      this.loadMorePosts();
    }
  }

  private async loadMorePosts() {
    // 다음 배치 로드
    // PostIndexCache 또는 PostDataParser 사용
  }

  private render() {
    // visiblePosts만 렌더링
    // 절대 위치 지정으로 가상 스크롤 구현
  }
}
```

---

## 📊 예상 성능 개선

### 10,000 포스트 로딩

| 단계 | 현재 | 최적화 후 | 개선율 |
|------|------|----------|--------|
| **Frontmatter 파싱** | 8초 | 0초 (캐시됨) | 100% |
| **디스크 I/O** | 500MB | 0MB (캐시된 경우) | 100% |
| **메모리 사용** | 500MB | 50MB | 90% |
| **총 로딩 시간** | 8초 | 0.5-1초 | 87% |

### 필터링/정렬 성능

| 작업 | 현재 | 최적화 후 |
|------|------|----------|
| 플랫폼 필터 | O(n) 파일 읽기 | O(n) 메모리만 |
| 날짜 범위 필터 | O(n) 파일 읽기 | O(n) 메모리만 |
| 태그 필터 | O(n) 파일 읽기 | O(1) 인덱스 조회 |
| 정렬 | O(n log n) | O(n log n) (변화 없음) |

---

## 🚀 구현 순서

### Immediate (현재 task 완료 후)

1. **PostDataParser 리팩토링** (우선순위: 최상)
   - MetadataCache 활용
   - cachedRead() 사용
   - parseFrontmatter 제거

2. **TimelineContainer 업데이트**
   - App 전달

### Medium (1-2주 내)

3. **PostIndexCache 서비스 추가**
   - 플랫폼별 인덱싱
   - 이벤트 기반 캐시 무효화

4. **FilterSortManager 최적화**
   - PostIndexCache 통합

### Optional (필요 시)

5. **가상 스크롤링**
   - VirtualScrollTimeline 컴포넌트
   - Deferred Views 패턴

6. **파일 구조 최적화**
   - 시간별 폴더 세분화
   - 압축 아카이빙 (90일+)

---

## 📝 테스트 계획

### 성능 벤치마크

```typescript
// 테스트 케이스
const testCases = [
  { fileCount: 100, expectedTime: '<100ms' },
  { fileCount: 1000, expectedTime: '<500ms' },
  { fileCount: 10000, expectedTime: '<2s' },
];
```

### 메모리 프로파일링

Chrome DevTools Memory Profiler로 측정:
- Heap Snapshot 비교 (최적화 전/후)
- 메모리 누수 확인

---

## ⚠️ 주의사항

### Obsidian API 제약

1. **onLayoutReady 사용 필수**
   - `vault.on('create')` 이벤트는 초기 로딩 시 모든 파일에 대해 발생
   - `workspace.onLayoutReady()` 내부에서 등록 필요
   - 참고: `reference/obsidian-developer-docs/en/Plugins/Guides/Optimizing plugin load time.md`

2. **MetadataCache 이벤트**
   - `changed` - 파일 인덱싱 완료 (frontmatter 변경)
   - `resolved` - 모든 파일 인덱싱 완료
   - `deleted` - 파일 삭제
   - 참고: `MetadataCache.md` 문서

3. **cachedRead vs read**
   - `cachedRead()` - 읽기 전용, 캐시 활용
   - `read()` - 수정 후 저장 시 사용
   - 외부 수정 시 둘 다 최신 버전 반환

---

## 🔗 참고 문서

- `reference/obsidian-developer-docs/en/Plugins/Vault.md`
- `reference/obsidian-developer-docs/en/Reference/TypeScript API/MetadataCache.md`
- `reference/obsidian-developer-docs/en/Plugins/Guides/Optimizing plugin load time.md`
- `reference/obsidian-developer-docs/en/Plugins/Guides/Understanding deferred views.md`

---

**작성일**: 2025-01-01
**작성자**: Claude Code
**버전**: 1.0
