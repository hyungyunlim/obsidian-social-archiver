# Social Archiver API - Cloudflare Workers

## 🚀 배포 가이드

### 1. Cloudflare 계정 설정

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. Workers & Pages 섹션으로 이동

### 2. Wrangler 로그인

```bash
cd workers
npm install
npx wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 로그인을 승인하세요.

### 3. KV Namespaces 생성

```bash
# KV 네임스페이스 생성
npx wrangler kv:namespace create "ARCHIVE_CACHE"
npx wrangler kv:namespace create "LICENSE_KEYS"
npx wrangler kv:namespace create "SHARE_LINKS"

# Preview (개발용) 네임스페이스 생성
npx wrangler kv:namespace create "ARCHIVE_CACHE" --preview
npx wrangler kv:namespace create "LICENSE_KEYS" --preview
npx wrangler kv:namespace create "SHARE_LINKS" --preview
```

각 명령어 실행 후 나오는 ID를 복사해서 `wrangler.toml`에 업데이트하세요.

### 4. wrangler.toml 업데이트

```toml
[[kv_namespaces]]
binding = "ARCHIVE_CACHE"
id = "여기에_실제_ID_입력"
preview_id = "여기에_preview_ID_입력"

[[kv_namespaces]]
binding = "LICENSE_KEYS"
id = "여기에_실제_ID_입력"
preview_id = "여기에_preview_ID_입력"

[[kv_namespaces]]
binding = "SHARE_LINKS"
id = "여기에_실제_ID_입력"
preview_id = "여기에_preview_ID_입력"
```

### 5. 환경 변수 설정

```bash
# API 키 설정 (필요한 경우)
npx wrangler secret put BRIGHTDATA_API_KEY
npx wrangler secret put PERPLEXITY_API_KEY
npx wrangler secret put GUMROAD_API_KEY
npx wrangler secret put HMAC_SECRET
```

각 명령어 실행 후 프롬프트에 실제 API 키를 입력하세요.

### 6. 로컬 개발

```bash
# 로컬 개발 서버 시작
npm run dev

# 브라우저에서 확인
# http://localhost:8787
```

### 7. 배포

```bash
# 프로덕션 배포
npm run deploy

# 또는 직접 wrangler 명령어
npx wrangler deploy
```

### 8. 배포 확인

배포 후 출력되는 URL로 접속:
- `https://social-archiver-api.<your-subdomain>.workers.dev`
- Health check: `https://social-archiver-api.<your-subdomain>.workers.dev/health`

### 9. 로그 모니터링

```bash
# 실시간 로그 확인
npm run tail

# 또는
npx wrangler tail
```

## 🔧 문제 해결

### KV Namespace 오류
- `wrangler.toml`의 ID가 정확한지 확인
- Dashboard에서 Workers > KV 섹션 확인

### 배포 실패
- Node.js 버전 확인 (16.13.0 이상)
- `npm install` 다시 실행
- `npx wrangler whoami`로 로그인 확인

### CORS 오류
- Obsidian 앱에서 테스트 시 `app://obsidian.md` origin 확인
- 개발 시 `http://localhost` 추가

## 📝 다음 단계

1. Custom Domain 설정 (선택)
   - Cloudflare Dashboard > Workers > Routes
   - `api.your-domain.com/*` 추가

2. Analytics 확인
   - Dashboard > Workers > Analytics

3. Rate Limiting 조정
   - `wrangler.toml`에서 limit 값 수정

## 🔗 유용한 링크

- [Wrangler 문서](https://developers.cloudflare.com/workers/wrangler/)
- [Workers KV 문서](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Hono 문서](https://hono.dev/)