# YouTube Transcript Feature Design

## Overview
유튜브 영상 아카이브 시 자막(transcript) 데이터를 포함하여 저장하고, 타임스탬프를 클릭하여 해당 시점으로 이동할 수 있는 기능 구현.

## Data Structure

### BrightData API Response
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "video_id": "VIDEO_ID",
  "video_length": 1025,
  "transcript": "전체 자막 텍스트 (띄어쓰기 없이 연속된 텍스트)",
  "formatted_transcript": [
    {
      "start_time": 0,
      "end_time": 27000,
      "duration": 27000,
      "text": "지프를 해석하는 법"
    },
    {
      "start_time": 240,
      "end_time": 3320,
      "duration": 3080,
      "text": "자동차를 여러 가지 관점에서 해석할"
    }
  ]
}
```

**주의:** `start_time`, `end_time`, `duration`은 **밀리초(ms)** 단위

## Phase 1: Archive Modal Options (우선 구현)

### UI Design
유튜브 URL 감지 시 Advanced Options에 추가:

```
┌─────────────────────────────────────┐
│ 🎬 YouTube Options                  │
├─────────────────────────────────────┤
│ ☑ Include Transcript               │
│   (전체 자막 텍스트 포함)              │
│                                     │
│ ☑ Include Formatted Transcript     │
│   (타임스탬프별 챕터 링크 생성)         │
└─────────────────────────────────────┘
```

### YAML Frontmatter
```yaml
---
platform: youtube
hasTranscript: true
hasFormattedTranscript: true
videoId: "pg5IXEAgJ1o"
duration: 1025  # 초 단위
---
```

## Phase 2: Markdown Output (우선 구현)

### Output Format

#### Option 1: Formatted Transcript만 선택
```markdown
![](https://www.youtube.com/watch?v=VIDEO_ID)

## 📝 Transcript

> [!note]- Click to expand transcript
>
> **Chapter Links** (click to open at specific time):
>
> [00:00](https://www.youtube.com/watch?v=VIDEO_ID&t=0s) 지프를 해석하는 법
> [00:04](https://www.youtube.com/watch?v=VIDEO_ID&t=4s) 자동차를 여러 가지 관점에서 해석할
> [00:08](https://www.youtube.com/watch?v=VIDEO_ID&t=8s) 수 있습니다. 라이스타일 관점에서
> ...
```

#### Option 2: Both Transcript + Formatted Transcript
```markdown
![](https://www.youtube.com/watch?v=VIDEO_ID)

## 📝 Transcript

> [!note]- Click to expand transcript
>
> **Chapter Links** (click to open at specific time):
>
> [00:00](https://www.youtube.com/watch?v=VIDEO_ID&t=0s) 지프를 해석하는 법
> [00:04](https://www.youtube.com/watch?v=VIDEO_ID&t=4s) 자동차를 여러 가지 관점에서 해석할
> ...
>
> ---
>
> **Full Transcript:**
>
> (전체 자막 텍스트...)
```

### Implementation

#### Time Format Conversion
```typescript
// 밀리초 → "MM:SS" 또는 "HH:MM:SS"
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
```

#### URL Generation
```typescript
function generateTimestampUrl(videoId: string, timeInSeconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${timeInSeconds}s`;
}
```

## Phase 3: Timeline View Integration (추후 구현)

### Approach: postMessage API (No Official API)
**Reference:** https://medium.com/@mihauco/youtube-iframe-api-without-youtube-iframe-api-f0ac5fcf7c74

### Key Concept
YouTube iframe은 `postMessage`를 통해 제어 가능 (공식 API 불필요):

#### 1. iframe 설정
```typescript
// enablejsapi=1 파라미터 필수!
const iframe = document.createElement('iframe');
iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1`;

// iframe이 로드된 후에만 메시지 전송
iframe.addEventListener('load', () => {
  // 준비 완료
});
```

#### 2. 재생 제어 (Player Commands)
```typescript
// 재생
iframe.contentWindow.postMessage(
  '{"event": "command", "func": "playVideo"}',
  '*'
);

// 일시정지
iframe.contentWindow.postMessage(
  '{"event": "command", "func": "pauseVideo"}',
  '*'
);

// 정지
iframe.contentWindow.postMessage(
  '{"event": "command", "func": "stopVideo"}',
  '*'
);

// 특정 시점으로 이동 (초 단위)
iframe.contentWindow.postMessage(
  `{"event": "command", "func": "seekTo", "args": [${seconds}, true]}`,
  '*'
);

// 음소거
iframe.contentWindow.postMessage(
  '{"event": "command", "func": "mute"}',
  '*'
);
```

#### 3. 상태 수신 (Listening Mode)
```typescript
// 1단계: YouTube에게 "듣고 있다"고 알림
iframe.contentWindow.postMessage(
  '{"event": "listening"}',
  '*'
);

// 2단계: 메시지 수신 리스너 등록
window.addEventListener('message', (event) => {
  // 보안: YouTube origin 확인
  if (!event.origin.includes('youtube')) return;

  try {
    const data = JSON.parse(event.data);

    if (data.event === 'infoDelivery' && data.info) {
      const playerState = data.info.playerState;

      // playerState 값:
      // -1: unstarted
      //  0: ended
      //  1: playing
      //  2: paused
      //  3: buffering
      //  5: video cued

      console.log('Player state:', playerState);
    }
  } catch (e) {
    // Invalid JSON
  }
});
```

### Timeline UI Design

```
┌────────────────────────────────────────┐
│ 🎥 YouTube Video                       │
│ [                Player                ]│
├────────────────────────────────────────┤
│ 📝 Transcript                          │
│                                        │
│ 🔘 00:00 지프를 해석하는 법             │
│ 🔘 00:27 마지막 한정판                 │
│ 🔘 01:50 패덤 블루                     │
│ ...                                    │
│                                        │
│ [View all X chapters ▼]                │
└────────────────────────────────────────┘
```

클릭 시: iframe의 영상을 해당 시점으로 이동

### Benefits of postMessage Approach
- **공식 API 로드 불필요**: ~11kb의 추가 스크립트 요청 없음
- **간단한 구현**: 직접 postMessage 사용
- **Obsidian 환경에서도 작동**: 외부 스크립트 의존성 없음
- **빠른 초기화**: API 스크립트 로딩 대기 시간 제거

### Limitations
- **이벤트 리스닝 제한적**: `playerState` 변경 시에만 알림
- **공식 API 대비 기능 제한**: 일부 고급 기능 사용 불가
- **문서화 부족**: 비공식 방법이므로 YouTube 정책 변경 가능

### Important Notes

#### Autoplay 제한
```typescript
// YouTube는 음소거되지 않은 영상의 자동재생을 차단
// 페이지 로드 시 자동재생하려면 먼저 음소거 필수
iframe.contentWindow.postMessage(
  '{"event": "command", "func": "mute"}',
  '*'
);

iframe.contentWindow.postMessage(
  '{"event": "command", "func": "playVideo"}',
  '*'
);
```

#### NPM 패키지 (선택사항)
블로그 저자가 만든 패키지: [`youtube-iframe-ctrl`](https://www.npmjs.com/package/youtube-iframe-ctrl)
- 의존성 없음
- 간단한 API
- iframe 로딩 상태 자동 체크

**우리는 직접 구현 예정** (플러그인 번들 크기 최소화)

## Implementation Tasks

### Task 1: Archive Modal - YouTube Options
**Files:**
- `src/views/ArchiveModal.ts` (or Svelte component)

**Changes:**
1. URL 감지 로직에 유튜브 체크 추가
2. 유튜브 감지 시 Advanced Options에 체크박스 2개 추가:
   - `includeTranscript: boolean`
   - `includeFormattedTranscript: boolean`
3. 옵션을 API 요청에 포함

### Task 2: PostData Interface Extension
**Files:**
- `src/types/post.ts`

**Changes:**
```typescript
export interface PostData {
  // ... existing fields
  transcript?: {
    raw?: string;  // 전체 자막 텍스트
    formatted?: Array<{
      start_time: number;  // 밀리초
      end_time: number;    // 밀리초
      duration: number;    // 밀리초
      text: string;
    }>;
  };
  videoId?: string;  // YouTube video ID (for transcript links)
}
```

### Task 3: YamlFrontmatter Extension
**Files:**
- `src/types/archive.ts`

**Changes:**
```typescript
export interface YamlFrontmatter {
  // ... existing fields
  hasTranscript?: boolean;
  hasFormattedTranscript?: boolean;
  videoId?: string;
  duration?: number;  // 초 단위
}
```

### Task 4: MarkdownConverter - YouTube Transcript Rendering
**Files:**
- `src/services/MarkdownConverter.ts`

**Changes:**
1. `formatTranscript()` 메서드 추가:
   - formatted_transcript → 타임스탬프 링크 생성
   - raw transcript → 전체 텍스트 추가
2. YouTube 템플릿 업데이트:
   ```markdown
   {{content.text}}

   {{#if media}}
   ---
   {{media}}
   {{/if}}

   {{#if transcript}}
   ---
   {{transcript}}
   {{/if}}

   ---
   **Platform:** YouTube...
   ```

### Task 5: Timeline View - YouTube Player Integration (나중에)
**Files:**
- `src/components/timeline/TimelineContainer.ts`

**Implementation Steps:**

#### Step 1: YouTube Embed 수정
현재 Obsidian 마크다운 임베드(`![](url)`)를 iframe으로 변경:

```typescript
private renderYouTubePlayer(videoId: string, containerEl: HTMLElement): HTMLIFrameElement {
  const iframe = containerEl.createEl('iframe', {
    attr: {
      src: `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1`,
      width: '100%',
      height: '400',
      frameborder: '0',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: ''
    }
  });

  iframe.style.cssText = 'border-radius: 8px; margin-bottom: 16px;';

  return iframe;
}
```

#### Step 2: YouTube Player Controller 클래스
```typescript
class YouTubePlayerController {
  private iframe: HTMLIFrameElement;
  private ready = false;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;

    // iframe 로드 완료 대기
    this.iframe.addEventListener('load', () => {
      this.ready = true;
      // listening 모드 활성화
      this.sendCommand('listening');
    });
  }

  private sendCommand(func: string, args: any[] = []): void {
    if (!this.ready) {
      console.warn('[YouTubePlayer] Not ready yet');
      return;
    }

    const message = JSON.stringify({
      event: func === 'listening' ? 'listening' : 'command',
      func: func === 'listening' ? undefined : func,
      args
    });

    this.iframe.contentWindow?.postMessage(message, '*');
  }

  public seekTo(seconds: number): void {
    this.sendCommand('seekTo', [seconds, true]);
  }

  public play(): void {
    this.sendCommand('playVideo');
  }

  public pause(): void {
    this.sendCommand('pauseVideo');
  }

  public mute(): void {
    this.sendCommand('mute');
  }
}
```

#### Step 3: Transcript 챕터 렌더링 (타임라인 뷰용)
```typescript
private renderTranscriptChapters(
  transcript: TranscriptEntry[],
  videoId: string,
  player: YouTubePlayerController,
  containerEl: HTMLElement
): void {
  const chaptersContainer = containerEl.createDiv({
    cls: 'transcript-chapters'
  });

  chaptersContainer.style.cssText = `
    max-height: 300px;
    overflow-y: auto;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 12px;
  `;

  // 처음 3개만 표시
  const initialCount = 3;
  let expanded = false;

  const renderChapters = (count: number) => {
    chaptersContainer.empty();

    transcript.slice(0, count).forEach((entry) => {
      const chapterBtn = chaptersContainer.createDiv({
        cls: 'transcript-chapter-btn'
      });

      chapterBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 6px;
        transition: background 0.2s;
        margin-bottom: 4px;
      `;

      const timeDisplay = this.formatTimestampDisplay(entry.start_time);
      const timeSeconds = Math.floor(entry.start_time / 1000);

      chapterBtn.innerHTML = `
        <span style="font-family: monospace; color: var(--interactive-accent); font-weight: 600; min-width: 50px;">
          ${timeDisplay}
        </span>
        <span style="color: var(--text-normal); flex: 1;">
          ${entry.text}
        </span>
      `;

      chapterBtn.addEventListener('mouseenter', () => {
        chapterBtn.style.background = 'var(--background-modifier-hover)';
      });

      chapterBtn.addEventListener('mouseleave', () => {
        chapterBtn.style.background = '';
      });

      chapterBtn.addEventListener('click', () => {
        player.seekTo(timeSeconds);
      });
    });

    // "View all" 버튼
    if (transcript.length > initialCount) {
      const toggleBtn = chaptersContainer.createDiv({
        cls: 'view-all-btn'
      });

      toggleBtn.style.cssText = `
        text-align: center;
        padding: 8px;
        cursor: pointer;
        color: var(--interactive-accent);
        font-weight: 600;
        font-size: 13px;
      `;

      toggleBtn.textContent = expanded
        ? 'Show less ▲'
        : `View all ${transcript.length} chapters ▼`;

      toggleBtn.addEventListener('click', () => {
        expanded = !expanded;
        renderChapters(expanded ? transcript.length : initialCount);
      });
    }
  };

  renderChapters(initialCount);
}
```

#### Step 4: 통합 (Post Card Rendering)
```typescript
private renderPostCard(container: HTMLElement, post: PostData): void {
  // ... 기존 코드 ...

  // YouTube 전용 처리
  if (post.platform === 'youtube' && post.videoId) {
    const iframe = this.renderYouTubePlayer(post.videoId, card);
    const player = new YouTubePlayerController(iframe);

    // Transcript 있으면 챕터 버튼 렌더링
    if (post.transcript?.formatted && post.transcript.formatted.length > 0) {
      const transcriptSection = card.createDiv({
        cls: 'transcript-section'
      });

      const header = transcriptSection.createDiv();
      header.style.cssText = 'font-weight: 600; margin-bottom: 8px; font-size: 14px;';
      header.textContent = '📝 Chapters';

      this.renderTranscriptChapters(
        post.transcript.formatted,
        post.videoId,
        player,
        transcriptSection
      );
    }
  }

  // ... 기존 코드 ...
}
```

## Testing Checklist

### Phase 1 & 2 (Markdown Output)
- [ ] 유튜브 URL 입력 시 옵션 표시 확인
- [ ] Transcript만 선택 시 전체 텍스트만 출력
- [ ] Formatted Transcript 선택 시 타임스탬프 링크 생성
- [ ] 타임스탭프 클릭 시 새 창에서 해당 시점부터 재생
- [ ] 시간 포맷 확인 (MM:SS, HH:MM:SS)
- [ ] YAML frontmatter 필드 정확성 확인

### Phase 3 (Timeline View)
- [ ] 타임라인에서 유튜브 영상 iframe 렌더링
- [ ] Transcript 챕터 리스트 표시
- [ ] 챕터 클릭 시 임베드된 영상 시점 이동
- [ ] postMessage 통신 정상 작동 확인

## References
- YouTube IFrame API (공식): https://developers.google.com/youtube/iframe_api_reference
- postMessage 활용 방법: https://medium.com/@mihauco/youtube-iframe-api-without-youtube-iframe-api-f0ac5fcf7c74
- BrightData YouTube API docs: (internal reference)

## Notes
- 모든 시간 데이터는 밀리초(ms) 단위로 제공되므로 초(s) 변환 필수
- Obsidian callout 문법 활용: `> [!note]- Click to expand`
- YouTube Player API 대신 postMessage 사용으로 번들 크기 최소화
