# Social Archiver 프로젝트 셋업 가이드

## 🚀 Task Master 초기 설정

### 1. 프로젝트 초기화
```bash
# Task Master 초기화 (이미 완료된 경우 skip)
task-master init

# AI 모델 설정 (대화형) - 리서치를 위해 먼저 설정
task-master models --setup

# 프로젝트 리서치 수행 (PRD 파싱 전 필수)
task-master research --context="Obsidian plugin development, Social media archiving, Svelte 5 Runes API"

# PRD 파싱 및 태스크 생성 (286개 태스크)
task-master parse-prd .taskmaster/docs/prd.txt --research
```

### ⚠️ Obsidian 플러그인 정책 준수
- 커뮤니티 플러그인은 **무료 배포** 필수
- 결제는 **외부(Gumroad)** 처리
- 플러그인 내 직접 결제 **금지**
- 설정에 기부/구매 링크 **허용**

### 2. 태스크 복잡도 분석 및 확장
```bash
# 전체 프로젝트 복잡도 분석 (리서치 기반)
task-master analyze-complexity --research

# 복잡도 리포트 확인
task-master complexity-report

# 높은 복잡도 태스크부터 순차적 확장
task-master expand --complexity=high --research
task-master expand --complexity=medium --research
task-master expand --complexity=low --research

# 또는 모든 태스크를 한번에 확장
# task-master expand --all --research
```

### 3. 의존성 설정 (순차적 진행)
```bash
# 핵심 의존성 체인 설정
task-master add-dependency --id=1.1 --depends-on=1.0  # 환경 설정 → Obsidian 플러그인 구조
task-master add-dependency --id=2.1 --depends-on=1.3  # UI 컴포넌트 → 기본 플러그인
task-master add-dependency --id=3.1 --depends-on=2.3  # 아카이빙 기능 → UI 완성
task-master add-dependency --id=4.1 --depends-on=3.3  # AI 분석 → 아카이빙 완성
task-master add-dependency --id=5.1 --depends-on=4.3  # 공유 시스템 → AI 완성

# 의존성 검증
task-master validate-dependencies
```

## 📋 PRD 기반 9단계 구조 (286개 태스크)

### Phase 1: MVP Foundation (Week 1) - 52개 태스크
```bash
# 주요 태스크 확인
task-master list --filter="phase:1"

# 핵심 태스크 예시
# - Obsidian 플러그인 보일러플레이트 설정
# - Svelte 5 Runes API 설정
# - TypeScript 5.0+ strict mode
# - SRP 패턴 서비스 클래스들 (ArchiveService, MarkdownConverter, VaultManager)
# - 통합 에러 스키마 구현
# - Zod 스키마 정의 (schemaVersion 포함)
# - Async job flow 아키텍처
# - URL 정규화 및 SSRF 보호
```

### Phase 2: Licensing & Payment [External] (Week 2) - 33개 태스크
```bash
# 외부 결제 모델 구현
task-master list --filter="phase:2"

# 핵심 태스크 예시
# - Gumroad API 통합 (외부 결제)
# - HMAC 서명 검증 구현
# - 크레딧 시스템 (기본:1, AI:3, 딥리서치:5)
# - Circuit breaker 패턴
# - 라이선스 로컬 암호화
# - Idempotency key 처리
```

### Phase 3: Full Platform Support (Week 3-4) - 59개 태스크
```bash
# 6개 플랫폼 지원
task-master list --filter="phase:3"

# 핵심 기능:
# - 플랫폼별 URL 정규화
# - 미디어 해시 기반 중복 제거
# - 설정 가능한 미디어 전략 (SAVE_MEDIA)
# - 24-48시간 캐시
# - 리다이렉트 3-hop 제한
# - 트래킹 파라미터 제거
```

### Phase 4: AI Enhancement (Week 4) - 21개 태스크
```bash
# Perplexity API 통합
task-master list --filter="phase:4"

# AI 기능:
# - AIYamlGenerator 서비스
# - 감정 분석, 토픽 추출
# - Deep Research (Pro 기능)
# - 팩트체킹, 신뢰도 점수
```

### Phase 5: Sharing System (Week 5) - 23개 태스크
```bash
# Share Note 스타일 공유
task-master list --filter="phase:5"

# 공유 기능:
# - 30일 임시 (무료) / 영구 (Pro)
# - R2 스토리지 (Pro) / KV Store (무료, 1MB)
# - XSS 보호 및 DMCA 지원
# - 삭제 엔드포인트
# - X-Robots-Tag: noindex
```

### Phase 6: Mobile Optimization (Week 5) - 41개 태스크
```bash
# 모바일 퍼스트 설계
task-master list --filter="phase:6"

# 모바일 기능:
# - 44px 최소 터치 타겟
# - PWA 및 Service Worker
# - 진행 상태 표시 (phases)
# - 접근성 (ARIA, 키보드 네비게이션)
# - 플랫폼별 모바일 UX
```

### Phase 7: Testing & QA (Week 5-6) - 26개 태스크
```bash
# 테스트 및 품질 보증
task-master list --filter="phase:7"

# 테스트 전략:
# - Contract tests (BrightData snapshots)
# - 성능 가드 (p95 ≤ X초)
# - 보안 테스트 (SSRF, XSS)
# - 스키마 스냅샷 테스트
# - 부분 fallback 전략
```

### Phase 8: DevOps & CI/CD (Week 5-6) - 31개 태스크
```bash
# 자동화 및 모니터링
task-master list --filter="phase:8"

# DevOps:
# - 구조화된 JSON 로깅
# - 메트릭 (p95, 비용, 캐시)
# - Cloudflare Queues
# - Fallback 전략 (oEmbed/OpenGraph)
# - Parser 실패율 모니터링
```

### Phase 9: Launch Preparation (Week 6) - 24개 태스크
```bash
# 출시 준비
task-master list --filter="phase:9"

# 출시 체크리스트:
# - Obsidian Community Plugins 제출 (무료 버전)
# - Gumroad 외부 구매 페이지 설정
# - 라이선스 활성화 튜토리얼
# - Product Hunt 런칭 자료
```

## 🔄 일일 워크플로우

### 매일 아침 시작
```bash
# 오늘의 태스크 확인
task-master next
task-master show <id>

# 상태 업데이트
task-master set-status --id=<id> --status=in-progress

# 구현 노트 추가 (진행중)
task-master update-subtask --id=<id> --prompt="오늘 구현할 내용: ..."
```

### 구현 완료 후
```bash
# 완료 표시
task-master set-status --id=<id> --status=done

# 다음 태스크 확인
task-master next

# 전체 진행 상황 확인
task-master list
```

## 🎯 우선순위 태스크 (MVP)

### Week 1-2 필수
1. **Obsidian 플러그인 구조** (Phase 1)
2. **SRP 서비스 클래스** (Phase 1) 
3. **외부 라이선스 시스템** (Phase 2)
4. **Facebook/LinkedIn 지원** (Phase 3 일부)

### Week 3-4 핵심
5. **전체 플랫폼 지원** (Phase 3)
6. **미디어 처리** (Phase 3)
7. **AI YAML 생성** (Phase 4)
8. **공유 시스템** (Phase 5)

### Week 5-6 완성
9. **모바일 최적화** (Phase 6)
10. **테스트 스위트** (Phase 7)
11. **CI/CD 파이프라인** (Phase 8)
12. **커뮤니티 플러그인 제출** (Phase 9)

## 💡 팁

### 병렬 작업 가능한 태스크
- UI 개발과 백엔드 API 통합은 동시 진행 가능
- 문서화는 개발과 병행
- 테스트는 기능 완성 즉시 작성

### 리스크 관리
```bash
# 블로커 발생 시
task-master set-status --id=<id> --status=blocked
task-master update-task --id=<id> --prompt="블로커: API 키 필요..."

# 태스크 재조정
task-master move --from=<id> --to=<new-id>
```

### Claude Code 세션 관리
```bash
# 특정 태스크 작업 시작
claude -p "task-master show 1.1"

# 컨텍스트 초기화
/clear

# 태스크 완료 후
claude -p "task-master set-status --id=1.1 --status=done && task-master next"
```

## 📁 프로젝트 구조 (SRP 패턴 + Improvements)

```bash
obsidian-social-archiver/
├── src/
│   ├── main.ts                         # Phase 1: 플러그인 엔트리
│   ├── components/                     
│   │   ├── ArchiveModal.svelte        # Phase 1: 미니멀 UI
│   │   ├── TimelineView.svelte        # Phase 3: 타임라인
│   │   └── ShareIcon.svelte           # Phase 5: 공유 아이콘
│   ├── services/                       # SRP 패턴
│   │   ├── ArchiveService.ts          # Phase 1: API 통신만
│   │   ├── MarkdownConverter.ts       # Phase 1: 변환만
│   │   ├── VaultManager.ts            # Phase 1: Vault만
│   │   ├── LicenseValidator.ts        # Phase 2: 라이선스만
│   │   ├── MediaHandler.ts            # Phase 3: 미디어만
│   │   ├── platforms/                 # Phase 3: 플랫폼별
│   │   │   ├── FacebookService.ts
│   │   │   ├── LinkedInService.ts
│   │   │   └── ...
│   │   ├── schemas/                   # Phase 1: Zod 스키마
│   │   │   ├── postData.ts           # PostData with schemaVersion
│   │   │   ├── timelineData.ts       
│   │   │   └── aiOptions.ts
│   │   ├── security/                  # Phase 1: 보안
│   │   │   ├── url-validator.ts      # SSRF 보호
│   │   │   └── sanitizer.ts          # XSS 보호
│   │   ├── cache/                     # Phase 1: 캐싱
│   │   │   └── dedup-cache.ts        # 24-48시간 캐시
│   │   ├── resilience/                # Phase 2: 복원력
│   │   │   ├── circuit-breaker.ts    
│   │   │   └── exponential-backoff.ts
│   │   ├── monitoring/                # Phase 8: 모니터링
│   │   │   └── metrics.ts            # 구조화된 로깅
│   │   └── ai/                        
│   │       ├── AIYamlGenerator.ts     # Phase 4: AI YAML
│   │       └── DeepResearchService.ts # Phase 4: Deep Research
│   ├── hooks/                          # Svelte 5 Runes
│   │   ├── useArchiveState.ts         # Phase 3
│   │   ├── useLicense.ts              # Phase 3
│   │   └── usePlatformDetection.ts   # Phase 3
│   ├── errors/                        
│   │   ├── ArchiveError.ts            # Phase 7: 에러 클래스
│   │   └── ErrorHandler.ts            # Phase 7: 에러 처리
│   ├── workers/                       
│   │   ├── share-handler.ts           # Phase 5: 공유 워커
│   │   ├── share-manager.ts           # Phase 5: 공유 관리
│   │   ├── job-handler.ts             # Phase 1: Async jobs
│   │   └── webhook-handler.ts         # Phase 2: Gumroad webhooks
│   └── templates/                     # Phase 1: 버전화된 템플릿
│       └── v1/
│           └── archive.md
├── manifest.json                       # Phase 1: 플러그인 매니페스트
├── package.json                        # Phase 1: 의존성
├── tsconfig.json                      # Phase 1: TypeScript strict
├── vite.config.ts                     # Phase 1: Vite 설정
├── .env.example                       # API 키 + 설정 템플릿
│   # SAVE_MEDIA=link|thumb|full
│   # MAX_MEDIA_MB=10
│   # CONCURRENCY=3
└── docs/
    ├── user-stories.md                # User Stories
    └── social-archiver.md             # 상세 스펙
```

## 🚨 중요 체크포인트

### Week 1 (Phase 1)
- ✅ Obsidian 플러그인 구조 완성
- ✅ SRP 서비스 클래스 구현
- ✅ 미니멀 아카이브 모달 작동

### Week 2 (Phase 2)
- ✅ 외부 라이선스 시스템 (Gumroad)
- ✅ 크레딧 시스템 구현
- ✅ 무료 체험 10 크레딧

### Week 3-4 (Phase 3-4)
- ✅ 6개 플랫폼 모두 지원
- ✅ AI YAML 생성 작동
- ✅ Deep Research (Pro)

### Week 5 (Phase 5-6)
- ✅ Share Note 스타일 공유
- ✅ PWA 및 모바일 최적화
- ✅ 플랫폼별 모바일 UX

### Week 6 (Phase 7-9)
- ✅ 테스트 커버리지 95%+
- ✅ CI/CD 파이프라인
- ✅ Community Plugins 제출
- ✅ Product Hunt 준비

## 📊 성공 지표

| 시점 | 목표 | 메트릭 |
|-----|-----|--------|
| Week 6 | 런칭 | 100+ 다운로드 |
| Month 2 | 수익화 | $500+ MRR |
| Month 3 | 성장 | $2,000+ MRR |
| Month 6 | 규모화 | $10,000+ MRR |

## 🔗 관련 문서

- 📄 [PRD 문서](.taskmaster/docs/prd.txt) - 286개 태스크 정의
- 📖 [User Stories](docs/user-stories.md) - 50개 사용자 스토리
- 🎯 [프로젝트 스펙](docs/social-archiver.md) - 상세 기술 명세
- 🛡️ [개선사항](docs/social-archiver-improvements.md) - 보안 및 성능 가드레일
- 💭 [CLAUDE_MEMORIZE.md](CLAUDE_MEMORIZE.md) - 핵심 정보 요약

---

*Task Master와 함께 체계적으로 Social Archiver를 구현하세요!*