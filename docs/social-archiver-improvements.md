# Social Archiver — Spec Improvements & Guardrails

This document complements docs/social-archiver.md with operational guardrails, security hardening, and implementation-ready patterns. Focus is on reducing production risk, controlling costs, and keeping the codebase maintainable.

## At-a-Glance Priorities
- Unified error model across APIs.
- Async archive job flow for reliability.
- URL safety, canonicalization, and dedup caching.
- Versioned schemas and markdown templates.
- Observability and cost protections.

---

## API & Backend

- Unified Error Schema: Apply to all endpoints.
  - Shape: `{ code, message, details?, retryAfter? }`
  - Common codes: `INVALID_URL, PLATFORM_NOT_SUPPORTED, LICENSE_INVALID, CREDITS_EXHAUSTED, RATE_LIMIT, NETWORK_ERROR, PLATFORM_BLOCKED, CAPTCHA_REQUIRED, CONTENT_REMOVED, MEDIA_DOWNLOAD_FAILED, CONTENT_TOO_LARGE`.
  - Example:
    ```json
    {
      "code": "RATE_LIMIT",
      "message": "Too many requests. Please wait.",
      "retryAfter": 30,
      "details": { "limit": 20, "window": 60 }
    }
    ```

- Async Job Flow: More resilient than long synchronous calls on Workers.
  - `POST /archive?mode=async` → `{ jobId }`
  - `GET /jobs/{jobId}` → `{ status: queued|running|failed|completed, data?, error? }`
  - `POST /archive?mode=sync` can remain for small posts; internally share the same pipeline.

- SSRF & URL Safety:
  - Server-side allowlist per platform; cap redirects (e.g., ≤ 3) and re-validate final host.
  - Reject private IP ranges and non-HTTP(S). Normalize and store canonical URL.

- Dedup & Caching:
  - Normalize URL (strip tracking params, resolve canonical). Key: `hash(platform + canonicalUrl)`.
  - Cache successful results 24–48h to avoid duplicate scraping charges.

- Rate Limits & Credits:
  - Evaluate by license key + IP + canonical URL. Differentiate soft (429) vs. hard blocks.
  - Gumroad webhook: verify HMAC signature; persist idempotency key to prevent double crediting.

- Failure Handling:
  - Circuit breaker around BrightData; exponential backoff with jitter.
  - Partial fallbacks: return text-only when media fetch fails.

- Share Storage (KV):
  - Enforce TTL by default; add delete endpoint `POST /share/delete/{viewId}`.
  - Sanitize output HTML for `/view/{viewId}` to prevent XSS. Avoid storing PII; if required, encrypt at rest or exclude.

- Observability:
  - Structured logs (JSON) with requestId, licenseType, platform, latency, cost.
  - Metrics: success rate, failure rate by code, p95 latency, retries, external-call time, per-platform cost.

### Endpoint Reference (Additions)
```yaml
POST /archive?mode=sync|async
  body: { url: string, licenseKey: string, aiOptions?: AIOptions }
  response(sync): { data: PostData, remaining: number }
  response(async): { jobId: string }

GET /jobs/{jobId}
  response: { status: 'queued'|'running'|'failed'|'completed', data?: PostData, error?: ApiError }

POST /share/delete/{viewId}
  body: { reason?: string }
  response: { success: boolean }
```

---

## Data Model & Markdown

- Versioned Schemas: Define with Zod/TypeBox and include `schemaVersion`.
  - File paths: `src/services/schemas/postData.ts`, `timelineData.ts`, `aiOptions.ts`.
  - Example (Zod):
    ```ts
    // src/services/schemas/postData.ts
    import { z } from 'zod';

    export const PostData = z.object({
      schemaVersion: z.literal('1.0.0'),
      platform: z.enum(['facebook','linkedin','instagram','tiktok','x','threads']),
      postId: z.string(),
      canonicalUrl: z.string().url(),
      author: z.object({ id: z.string().optional(), name: z.string().optional(), handle: z.string().optional() }).optional(),
      publishedAt: z.string().datetime().optional(),
      content: z.string().default(''),
      media: z.array(z.object({
        type: z.enum(['image','video','link','audio']),
        url: z.string().url(),
        width: z.number().optional(),
        height: z.number().optional(),
        alt: z.string().optional()
      })).default([]),
      engagement: z.object({ likes: z.number().optional(), comments: z.number().optional(), shares: z.number().optional() }).optional(),
      extras: z.record(z.any()).optional()
    });
    export type PostData = z.infer<typeof PostData>;
    ```

- Markdown Frontmatter Standard:
  ```yaml
  ---
  x-spec-version: 1.0.0
  platform: x
  post_id: 1234567890
  canonical_url: https://x.com/user/status/123
  archived_at: 2025-08-26T12:34:56Z
  source_author: '@user'
  media_count: 2
  license_type: credits
  ---
  ```

- Media Strategy:
  - Config flags: `SAVE_MEDIA=link|thumb|full`, `MAX_MEDIA_MB`, `CONCURRENCY`.
  - Storage path: `assets/social/<platform>/<postId>/<hash>.<ext>`; deduplicate by content hash.
  - Preserve alt/caption; fallback to link when download fails.

- Content Normalization:
  - Handle emoji/RTL; escape code blocks and links; consistent newlines.
  - Comments/threads: policy configurable (top N, all, summarized).

- Safe HTML:
  - Sanitize embeds; prefer Obsidian embeds `![[...]]`. Maintain allowlist for iframes.

---

## Client Plugin & UX

- Progress & Status:
  - Poll/SSE for async jobs with phases: validate → scrape → parse → convert → save.
  - On failure, offer "Save text-only" retry option.

- Filename & Duplicates:
  - Convention: `[YYYY-MM-DD] <platform>-<slug>-<shortId>.md`.
  - Re-archive policy: update-in-place vs. versioned copies; configurable.

- URL Detection:
  - Combine regex with canonical resolve to reduce false matches; support localized domains.

- Mobile Flow:
  - Note Obsidian Mobile plugin constraints and permission prompts.
  - Share Extension → Workers (job) → Obsidian pull/import flow.

- Accessibility Checklist:
  - Keyboard navigation, focus trap, contrast, ARIA labels, live region for progress.

---

## Security & Compliance

- License Handling:
  - Store locally with simple encryption/obfuscation; never log or send to third parties. Credits validated server-side only.

- Domain Allowlist:
  - Prevent open-proxy misuse by restricting to known social domains; enforce server-side.

- Legal & TOS:
  - Respect platform terms; exclude private/auth-only content; include copyright notice.
  - KV shares: support DMCA/delete requests; document contact and SLA.

- Privacy:
  - Telemetry is opt-in; document retention, processor, and data flows.

---

## Testing & Quality

- Contract Tests:
  - Snapshot anonymized BrightData responses; detect parser regressions.

- Performance Guards:
  - Define e2e SLA (e.g., p95 ≤ X s); test timeouts and backoff.

- Schema & Template Tests:
  - Validate `PostData` and snapshot rendered markdown.

- Security Tests:
  - SSRF, open redirect, XSS, path traversal unit/integration cases.

---

## Cost & Operations

- Cost Controls:
  - Daily free cap per user (e.g., 3), cache hits free/discounted; expose cost metrics.

- Fallback Paths:
  - When BrightData fails, try oEmbed/OpenGraph/public HTML minimal extraction.

- Queueing:
  - For bulk requests, use Cloudflare Queues; smooth spikes.

---

## Roadmap & Risks

- Scope MVP to 2–3 platforms (e.g., X, LinkedIn, Instagram); gate others behind beta flags.
- Monitor DOM changes via parser failure rate; prepare hotfix path.

---

## Actionable TODOs (Suggested Paths)

- Schemas: add `src/services/schemas/{postData,timelineData,aiOptions}.ts` (Zod) with `schemaVersion`.
- Templates: versioned directories under `src/services/templates/v1/...`.
- API: implement async job endpoints and unified error handler; add `/share/delete/{viewId}`.
- Caching: canonical URL normalization + KV cache 24–48h; dedup key by `hash(platform+canonicalUrl)`.
- Security: URL allowlist + redirect cap + private IP rejection; Gumroad HMAC + idempotency.
- Observability: structured logs, metrics, error sampling; dashboards for success/cost/latency.
- Config: `.env.example` include `SAVE_MEDIA`, `MAX_MEDIA_MB`, `CONCURRENCY`.

---

## Appendix: Sample Types & Events

- Error Type:
  ```ts
  type ApiError = {
    code: string;
    message: string;
    retryAfter?: number;
    details?: Record<string, unknown>;
  };
  ```

- Job Status Event (SSE or Poll):
  ```json
  { "jobId": "abc123", "phase": "parse", "progress": 0.6 }
  ```

- Observability Log (Workers):
  ```json
  {
    "ts": "2025-08-26T12:34:56Z",
    "reqId": "r-xyz",
    "platform": "x",
    "latencyMs": 1840,
    "attempts": 1,
    "result": "success",
    "cost": { "scrapeUsd": 0.006 }
  }
  ```
