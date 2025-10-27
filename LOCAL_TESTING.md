# Local Testing Guide

완전한 end-to-end 로컬 테스트 환경 설정 가이드입니다.

## 🚀 Quick Start (5분 안에 시작하기)

### 1단계: Workers 로컬 서버 시작

```bash
# Terminal 1
cd workers
npm run dev

# Workers 서버가 http://localhost:8787 에서 실행됩니다
```

### 2단계: 플러그인 빌드 & 배포

```bash
# Terminal 2 (프로젝트 루트에서)
npm run build:deploy
```

### 3단계: Obsidian에서 테스트

1. **Obsidian 열기** - test vault 선택
2. **설정 열기** - Settings → Community Plugins
3. **플러그인 활성화** - Social Archiver 토글 켜기
4. **설정 확인** - Settings → Social Archiver
   - API Endpoint가 `http://localhost:8787`로 설정되어 있는지 확인
   - **"Test Connection" 버튼 클릭**
   - ✅ "Connected! Server is healthy" 메시지 확인

## 🧪 테스트 시나리오

### 시나리오 1: API 연결 테스트

**목표**: 플러그인이 로컬 Workers와 통신하는지 확인

```
1. Obsidian 열기
2. Settings → Social Archiver
3. "Test Connection" 버튼 클릭
4. ✅ 성공 메시지 확인: "Connected! Server is healthy (production)"
```

**디버깅**:
- Workers가 실행 중인지 확인: `curl http://localhost:8787/health`
- Obsidian Developer Console 확인 (View → Toggle Developer Tools)

### 시나리오 2: Archive Modal 열기

**목표**: 기본 UI 작동 확인

```
1. 왼쪽 사이드바의 Archive 아이콘 클릭
   OR
2. Cmd/Ctrl + P → "Archive social media post"
```

**확인사항**:
- ✅ Modal이 열림
- ✅ URL 입력 필드 표시
- ✅ Disclaimer 메시지 표시
- ✅ Archive / Cancel 버튼 표시

### 시나리오 3: Clipboard 기능 테스트

**목표**: 클립보드에서 URL 자동 감지

```
1. 소셜 미디어 URL 복사
   예: https://www.linkedin.com/posts/example
2. Cmd/Ctrl + P → "Archive from clipboard URL"
3. ✅ URL이 자동으로 채워진 Modal 확인
```

### 시나리오 4: URL 검증 테스트

**목표**: 지원되는 플랫폼 URL만 허용하는지 확인

**지원 플랫폼**:
- ✅ Facebook (facebook.com, fb.com)
- ✅ LinkedIn (linkedin.com)
- ✅ Instagram (instagram.com)
- ✅ TikTok (tiktok.com)
- ✅ X / Twitter (x.com, twitter.com)
- ✅ Threads (threads.net)

**테스트**:
```
1. Archive Modal 열기
2. 각 플랫폼 URL 입력 테스트
3. 지원하지 않는 URL (예: youtube.com) 입력
4. ✅ 적절한 에러 메시지 확인
```

### 시나리오 5: Settings 페이지 테스트

**목표**: 모든 설정이 제대로 표시되고 저장되는지 확인

```
1. Settings → Social Archiver
2. 각 설정 변경
   - API Endpoint 변경
   - Archive/Media 경로 변경
   - Feature toggles 조작
3. Obsidian 재시작
4. ✅ 설정이 유지되는지 확인
```

## 🔧 개발 워크플로우

### 코드 수정 → 테스트 사이클

```bash
# 1. 코드 수정 (src/ 디렉토리)
# 2. 빌드 & 배포
npm run build:deploy

# 3. Obsidian에서 플러그인 리로드
Settings → Community Plugins → Social Archiver → ↻ 버튼

# 4. 테스트
# 5. 반복...
```

### Watch 모드 (자동 리빌드)

```bash
# Terminal 1: Workers 서버
cd workers && npm run dev

# Terminal 2: 플러그인 watch 모드
npm run dev

# Terminal 3: 자동 배포 스크립트
while true; do
  sleep 3
  node scripts/deploy-to-vault.mjs
done
```

## 🐛 디버깅

### Workers 로그 확인

**Terminal에서 실시간 로그 보기**:
```bash
cd workers
npm run dev
# 모든 API 요청이 실시간으로 표시됩니다
```

**로그 형식**:
```json
{
  "timestamp": "2025-10-27T...",
  "level": "info",
  "requestId": "req_...",
  "message": "GET /health",
  "url": "...",
  "method": "GET",
  "status": 200
}
```

### 플러그인 로그 확인

**Obsidian Developer Console**:
```
View → Toggle Developer Tools → Console
```

**필터 사용**:
```
[Social Archiver]
```

### 일반적인 문제 해결

#### 문제: "Cannot reach API server"

**원인**: Workers 서버가 실행되지 않음

**해결**:
```bash
cd workers
npm run dev
# 서버가 http://localhost:8787 에서 실행되는지 확인
curl http://localhost:8787/health
```

#### 문제: 플러그인이 로드되지 않음

**원인**: 빌드 에러 또는 파일 복사 실패

**해결**:
```bash
# 빌드 에러 확인
npm run build

# TypeScript 에러 확인
npm run typecheck

# 파일 존재 확인
ls -la ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/test/.obsidian/plugins/obsidian-social-archiver/
```

#### 문제: 변경사항이 반영되지 않음

**해결**:
1. Obsidian Developer Console에서 캐시 확인
2. 플러그인 완전히 껐다 켜기
3. Obsidian 완전 재시작
4. 빌드 재실행: `npm run build:deploy`

#### 문제: CORS 에러

**원인**: Workers CORS 설정

**확인**:
```typescript
// workers/src/index.ts
app.use('*', cors({
  origin: [
    'app://obsidian.md',
    'http://localhost',
    // ...
  ]
}));
```

## 📊 테스트 체크리스트

### 플러그인 기본 기능
- [ ] Ribbon icon이 표시됨
- [ ] Ribbon icon 클릭 시 Modal 열림
- [ ] Command Palette에서 "Archive social media post" 검색 가능
- [ ] Command Palette에서 "Archive from clipboard URL" 검색 가능
- [ ] Settings 탭이 표시됨
- [ ] Settings에서 API Endpoint 변경 가능
- [ ] "Test Connection" 버튼이 작동함

### API 연동
- [ ] Workers 서버가 http://localhost:8787에서 실행됨
- [ ] `/health` 엔드포인트가 200 응답
- [ ] `/ready` 엔드포인트가 KV 상태 확인
- [ ] CORS 헤더가 올바르게 설정됨
- [ ] 플러그인에서 API 호출 성공

### URL 검증
- [ ] Facebook URL 검증 통과
- [ ] LinkedIn URL 검증 통과
- [ ] Instagram URL 검증 통과
- [ ] TikTok URL 검증 통과
- [ ] X.com URL 검증 통과
- [ ] Threads URL 검증 통과
- [ ] 지원하지 않는 URL 거부

### Settings
- [ ] API Endpoint 설정 저장됨
- [ ] Archive path 설정 저장됨
- [ ] Media path 설정 저장됨
- [ ] Feature toggles 저장됨
- [ ] Obsidian 재시작 후에도 설정 유지
- [ ] Credits 정보 표시됨

### 개발자 경험
- [ ] Hot reload가 작동함 (dev mode)
- [ ] TypeScript 에러가 없음
- [ ] 빌드가 성공함
- [ ] 자동 배포 스크립트가 작동함
- [ ] 로그가 명확하게 표시됨

## 🚢 Production 배포 전 체크리스트

- [ ] 모든 테스트 통과
- [ ] TypeScript 컴파일 성공: `npm run typecheck`
- [ ] Lint 통과: `npm run lint`
- [ ] Workers 배포 테스트: `cd workers && wrangler deploy --dry-run`
- [ ] API Endpoint를 production으로 변경
- [ ] License key 검증 테스트
- [ ] Credit 시스템 테스트
- [ ] 에러 핸들링 확인
- [ ] 로그 레벨 확인 (production은 error/warn만)

## 📚 추가 리소스

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 상세한 개발 가이드
- [README.md](./README.md) - 프로젝트 개요
- [Workers 문서](./workers/README.md) - Workers API 문서

## 💡 팁

### 빠른 테스트를 위한 별칭

`.bashrc` 또는 `.zshrc`에 추가:

```bash
alias sa-dev='cd ~/obsidian-social-archiver && npm run dev'
alias sa-deploy='cd ~/obsidian-social-archiver && npm run build:deploy'
alias sa-workers='cd ~/obsidian-social-archiver/workers && npm run dev'
alias sa-test='cd ~/obsidian-social-archiver && npm test'
```

### VS Code 설정

`.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Workers",
      "type": "shell",
      "command": "cd workers && npm run dev",
      "isBackground": true
    },
    {
      "label": "Watch Plugin",
      "type": "shell",
      "command": "npm run dev",
      "isBackground": true
    },
    {
      "label": "Deploy to Vault",
      "type": "shell",
      "command": "npm run build:deploy"
    }
  ]
}
```

### 멀티 터미널 스크립트

`start-dev.sh`:

```bash
#!/bin/bash

# Start Workers
osascript -e 'tell app "Terminal" to do script "cd ~/obsidian-social-archiver/workers && npm run dev"'

# Start Plugin watch
osascript -e 'tell app "Terminal" to do script "cd ~/obsidian-social-archiver && npm run dev"'

# Open Obsidian
open -a Obsidian
```

```bash
chmod +x start-dev.sh
./start-dev.sh
```

## 🎯 다음 단계

로컬 테스트가 완료되었다면:

1. **Task 9 구현** - AI Enhancement Features
2. **통합 테스트** - End-to-end 시나리오
3. **Performance 테스트** - 대용량 데이터 처리
4. **Mobile 테스트** - iOS/Android에서 테스트
5. **Production 배포** - Cloudflare Workers 배포

---

**Happy Testing! 🚀**
