# Timeline View Documentation

## 개요

Timeline View는 아카이브된 소셜 미디어 포스트를 시간순으로 표시하는 커스텀 Obsidian 뷰입니다.

## 기술 스택

### 아키텍처
- **순수 TypeScript** - 프레임워크 종속성 없음
- **번들 크기**: ~195KB (gzip: ~58KB)
- **빌드 시간**: ~177ms

### 스타일링 전략
**Tailwind CSS + Obsidian CSS 변수 조합**

```typescript
// Tailwind 유틸리티 + Obsidian 테마 변수
cls: 'p-4 rounded-lg border border-[var(--background-modifier-border)] bg-[var(--background-primary)]'
```

#### 장점
- ✅ **빠른 개발**: Tailwind 유틸리티로 빠르게 스타일링
- ✅ **반응형 디자인**: `md:grid-cols-2 lg:grid-cols-3` 등으로 간편한 반응형
- ✅ **테마 통합**: Obsidian CSS 변수로 라이트/다크 모드 자동 대응
- ✅ **일관성**: Obsidian 네이티브 UI와 완벽한 조화
- ✅ **최적화**: 사용한 클래스만 번들에 포함

## 주요 기능

### 1. 파일 스캔 및 로딩
```typescript
// Obsidian MetadataCache API 사용
const cache = this.app.metadataCache.getFileCache(file);
const frontmatter = cache?.frontmatter as YamlFrontmatter;
```

**지원하는 필드:**
- `platform` (필수) - 플랫폼 식별자
- `author` - 작성자 이름
- `authorUrl` - 작성자 프로필 URL
- `originalUrl` - 원본 포스트 URL
- `archived` - 아카이브 날짜
- `likes`, `comments`, `shares`, `views` - 참여 메트릭

### 2. 날짜별 그룹핑

자동으로 다음과 같이 그룹화:
- **Today** - 오늘 아카이브된 포스트
- **Yesterday** - 어제 아카이브된 포스트
- **This Week** - 최근 7일 이내
- **Month Year** - 그 외 (예: "October 2024")

```typescript
function groupPostsByDate(posts: PostData[]): Map<string, PostData[]>
```

### 3. 실시간 검색

작성자 이름 및 포스트 내용에서 실시간 검색:

```typescript
// 대소문자 구분 없는 부분 일치 검색
const filtered = posts.filter(post =>
  post.content.text.toLowerCase().includes(query) ||
  post.author.name.toLowerCase().includes(query)
);
```

### 4. 반응형 그리드

**Tailwind 반응형 클래스:**
```typescript
cls: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
```

- **모바일** (< 768px): 1열
- **태블릿** (≥ 768px): 2열
- **데스크톱** (≥ 1024px): 3열

### 5. 플랫폼별 색상 배지

```css
/* styles.css */
.timeline-platform-badge[data-platform="facebook"] {
  background: #1877f2; /* Facebook Blue */
}

.timeline-platform-badge[data-platform="instagram"] {
  background: linear-gradient(45deg, ...); /* Instagram Gradient */
}
```

**지원 플랫폼:**
- Facebook (#1877f2)
- LinkedIn (#0077b5)
- Instagram (그라데이션)
- TikTok (#000000)
- X/Twitter (#000000)
- Threads (#000000)
- YouTube (#ff0000)

## 사용 방법

### 1. Timeline View 열기

**방법 1: Command Palette**
```
Cmd/Ctrl + P → "Open timeline view"
```

**방법 2: Ribbon Icon**
```
좌측 사이드바의 📅 (calendar-clock) 아이콘 클릭
```

**방법 3: 프로그래밍 방식**
```typescript
// 플러그인 코드에서
await this.app.workspace.getLeaf().setViewState({
  type: VIEW_TYPE_TIMELINE,
  active: true
});
```

### 2. 검색

상단 검색 바에서 키워드 입력:
- 포스트 내용 검색
- 작성자 이름 검색
- 실시간 필터링

### 3. 포스트 카드 상호작용

현재 구현된 기능:
- ✅ 호버 애니메이션 (그림자 + 약간 위로 이동)
- ✅ 플랫폼 배지 색상
- ✅ 작성자, 내용 미리보기, 메타데이터 표시

향후 추가 예정:
- [ ] 클릭 시 원본 노트로 이동
- [ ] 우클릭 컨텍스트 메뉴
- [ ] 미디어 썸네일 표시

## 스타일 커스터마이징

### Tailwind 유틸리티 클래스 수정

```typescript
// TimelineContainer.ts에서 cls 속성 수정

// 예: 카드 간격 조정
cls: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' // gap-4 → gap-6

// 예: 카드 패딩 증가
cls: 'p-6 rounded-lg ...' // p-4 → p-6
```

### 커스텀 CSS 추가

```css
/* styles.css에 추가 */

/* 예: 특정 플랫폼 배지 스타일 변경 */
.timeline-platform-badge[data-platform="custom"] {
  background: #yourcolor;
  color: white;
  font-weight: bold;
}

/* 예: 카드 호버 효과 커스터마이징 */
.timeline-post-card:hover {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  transform: translateY(-4px);
}
```

### Obsidian CSS 변수 활용

자주 사용하는 변수:
```css
--background-primary        /* 주 배경색 */
--background-secondary      /* 보조 배경색 */
--background-modifier-border /* 테두리 색 */
--text-normal               /* 일반 텍스트 */
--text-muted                /* 약한 텍스트 */
--text-faint                /* 매우 약한 텍스트 */
--interactive-accent        /* 강조 색 */
--interactive-accent-hover  /* 강조 색 호버 */
--text-on-accent           /* 강조 색 위의 텍스트 */
```

## 성능 최적화

### 1. 가상 스크롤 (미구현)
현재는 모든 포스트를 한 번에 렌더링하지만, 포스트가 1000개 이상일 경우 가상 스크롤 구현 권장:

```typescript
// 추후 구현 예정
import { VirtualScroll } from 'obsidian';
```

### 2. 이미지 지연 로딩
```typescript
// 미디어 추가 시 적용 예정
img.loading = 'lazy';
```

### 3. 디바운싱 검색
현재 실시간 검색이지만, 포스트가 많을 경우 디바운싱 추가 권장:

```typescript
let searchTimeout: NodeJS.Timeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    this.searchQuery = (e.target as HTMLInputElement).value;
    this.renderPosts();
  }, 300); // 300ms 디바운스
});
```

## 디버깅

### 콘솔 로그 확인

```javascript
// Obsidian 개발자 콘솔 (Cmd/Ctrl + Option + I)

// 아카이브 파일 목록 확인
app.vault.getMarkdownFiles()
  .filter(f => f.path.startsWith('Social Archives'))
  .forEach(f => console.log(f.path));

// 특정 파일의 frontmatter 확인
const file = app.vault.getMarkdownFiles()[0];
const cache = app.metadataCache.getFileCache(file);
console.log(cache?.frontmatter);

// Timeline View 인스턴스 확인
app.workspace.getLeavesOfType('social-archiver-timeline');
```

### 일반적인 문제 해결

**Q: 포스트가 표시되지 않습니다.**
```javascript
// 1. 파일 경로 확인
app.workspace.activeLeaf.view.component.archivePath
// → "Social Archives" 확인

// 2. frontmatter에 platform 필드가 있는지 확인
app.metadataCache.getFileCache(file)?.frontmatter?.platform
// → 'facebook', 'linkedin' 등이 있어야 함
```

**Q: 검색이 작동하지 않습니다.**
```typescript
// searchQuery 상태 확인
console.log(this.searchQuery);

// 필터링 결과 확인
console.log(this.filterPosts(this.posts, this.searchQuery));
```

## API Reference

### TimelineContainer 클래스

```typescript
class TimelineContainer {
  constructor(
    target: HTMLElement,
    props: {
      vault: Vault;
      app: App;
      archivePath: string;
    }
  )

  // Public methods
  destroy(): void

  // Private methods (참고용)
  private loadPosts(): Promise<void>
  private renderPosts(): void
  private renderPostCard(container: HTMLElement, post: PostData): void
  private filterPosts(posts: PostData[], query: string): PostData[]
  private groupPostsByDate(posts: PostData[]): Map<string, PostData[]>
}
```

### Props 인터페이스

```typescript
interface TimelineContainerProps {
  vault: Vault;           // Obsidian Vault 인스턴스
  app: App;               // Obsidian App 인스턴스
  archivePath: string;    // 아카이브 파일 경로 (예: "Social Archives")
}
```

## 향후 개선 사항

### 우선순위 높음
- [ ] 포스트 클릭 시 원본 노트 열기
- [ ] 가상 스크롤 (1000+ 포스트 대응)
- [ ] 플랫폼 필터 (Facebook만, Instagram만 등)
- [ ] 정렬 옵션 (최신순/오래된순/인기순)

### 우선순위 중간
- [ ] 미디어 썸네일 표시
- [ ] 날짜 범위 필터
- [ ] 무한 스크롤
- [ ] 포스트 카드 크기 조절

### 우선순위 낮음
- [ ] 애니메이션 설정
- [ ] 테마 커스터마이징 UI
- [ ] 통계 대시보드
- [ ] Export 기능

## 기여 가이드

Timeline View 개선에 기여하고 싶다면:

1. **Tailwind 클래스 사용** - `cls` 속성에 Tailwind 유틸리티 사용
2. **Obsidian CSS 변수 활용** - 테마 호환성을 위해 `var(--*)` 사용
3. **타입 안전성** - TypeScript strict mode 준수
4. **모바일 우선** - 최소 44px 터치 타겟
5. **성능 고려** - 대량 데이터 처리 시 최적화

## 라이선스

MIT License - Social Archiver Plugin

---

**Generated with ❤️ by Claude Code**
