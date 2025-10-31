# PRD: Link Preview Feature for Social Archiver

## 1. Executive Summary

### Feature Overview
Implement automatic link preview cards that extract and display metadata (title, description, image, favicon) from URLs embedded in archived social media posts. This feature enriches the user experience by providing visual context for shared links without requiring users to click through.

### Business Value
- **Enhanced UX**: Visual link previews improve content comprehension and engagement
- **Cost Efficiency**: Self-hosted solution using Cloudflare Workers ($0-5/month vs $30-250/month for external services)
- **Performance**: KV caching reduces redundant crawling and improves load times
- **Differentiation**: Adds value to archived posts, making them more useful for future reference

---

## 2. Goals & Background

### Primary Goals
1. Extract metadata from URLs in post content using Open Graph, Twitter Cards, and HTML meta tags
2. Display link preview cards when posts have no images/videos attached
3. Implement efficient caching to minimize crawling costs
4. Maintain fast page load times (<2s)

### Success Metrics
- Link preview extraction success rate: >90%
- Cache hit rate: >85%
- Page load time impact: <500ms
- Monthly cost: <$5 for 10,000 users

### Out of Scope (Phase 1)
- JavaScript-rendered sites (SPA support)
- Screenshot generation
- PDF/document previews
- Video preview thumbnails

---

## 3. User Stories

### As an Obsidian user archiving posts:
- I want URLs in my archived posts to be automatically analyzed
- I want link metadata extracted and saved to YAML frontmatter
- I expect this to happen seamlessly during the archive process

### As a share-web viewer:
- I want to see rich preview cards for links in posts
- I want previews to load quickly (from cache)
- I expect broken images to be handled gracefully
- I only want to see link previews when there are no post images/videos

---

## 4. Technical Architecture

### 4.1 Data Flow

```
┌─────────────────┐
│ Obsidian Plugin │ (Archive Time)
└────────┬────────┘
         │ 1. Extract URLs from content
         │ 2. Store URLs in PostData
         ↓
┌─────────────────┐
│ YAML Frontmatter│
│  linkPreviews:  │
│    - url: "..." │
└────────┬────────┘
         │
         │ (Share Time)
         ↓
┌─────────────────┐
│  Share-web SSR  │
└────────┬────────┘
         │ 3. Request metadata
         ↓
┌─────────────────┐
│  Worker API     │ /api/link-preview
└────────┬────────┘
         │ 4. Check KV cache
         ├─ Hit → Return cached
         └─ Miss → Crawl & cache
                  ↓
         ┌─────────────────┐
         │  External Site  │
         │  (HTTP Fetch)   │
         └─────────────────┘
```

### 4.2 Component Breakdown

#### A. Plugin (src/services/LinkPreviewExtractor.ts)
```typescript
class LinkPreviewExtractor {
  // Extract URLs from post content
  extractUrls(content: string): string[]

  // Store URLs in PostData
  addToPostData(post: PostData, urls: string[]): void
}
```

**YAML Structure:**
```yaml
---
linkPreviews:
  - url: "https://example.com"
  - url: "https://another.com/article"
---
```

#### B. Worker API (worker/src/handlers/link-preview.ts)
```typescript
// Endpoint: POST /api/link-preview
interface LinkPreviewRequest {
  url: string;
}

interface LinkPreviewResponse {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  error?: string;
}

async function handleLinkPreview(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Validate URL
  // 2. Check KV cache
  // 3. Fetch & parse HTML
  // 4. Extract metadata
  // 5. Cache result
  // 6. Return JSON
}
```

**Metadata Extraction Priority:**
1. Open Graph (`<meta property="og:*">`)
2. Twitter Cards (`<meta name="twitter:*">`)
3. Standard meta tags (`<meta name="description">`)
4. HTML title tag (`<title>`)
5. Fallback to URL

**Caching Strategy:**
- Cache key: `preview:${url}`
- TTL: 7 days (604,800 seconds)
- Storage: Cloudflare KV

#### C. Share-web (PostCard.svelte)
```svelte
<!-- Link Preview Cards -->
{#if visibleImages.length === 0 && linkPreviews?.length > 0}
  <div class="link-previews">
    {#each linkPreviews as preview}
      <LinkPreviewCard {preview} />
    {/each}
  </div>
{/if}
```

**LinkPreviewCard Component:**
```svelte
<a href={preview.url} class="link-preview-card" target="_blank">
  {#if preview.image}
    <img src={preview.image} alt={preview.title} onerror={handleError} />
  {/if}
  <div class="content">
    <h4>{preview.title}</h4>
    <p>{preview.description}</p>
    <span class="domain">{extractDomain(preview.url)}</span>
  </div>
</a>
```

---

## 5. Implementation Phases

### Phase 1: Worker API Foundation (Week 1)
**Priority: High**

**Tasks:**
1. Create `/api/link-preview` endpoint in Worker
2. Implement HTML fetching and meta tag extraction
3. Add KV caching logic
4. Handle errors and timeouts gracefully
5. Write unit tests for metadata extraction

**Deliverables:**
- Working API endpoint
- 90%+ metadata extraction success rate
- <2s response time for cache misses

### Phase 2: Plugin Integration (Week 2)
**Priority: High**

**Tasks:**
1. Create `LinkPreviewExtractor` service in plugin
2. Extract URLs from `post.content.text` during archiving
3. Add `linkPreviews` field to PostData interface
4. Save URLs to YAML frontmatter
5. Update existing archived posts (migration script)

**Deliverables:**
- URLs automatically extracted on archive
- Backward compatibility with existing posts

### Phase 3: Share-web Display (Week 2)
**Priority: Medium**

**Tasks:**
1. Create `LinkPreviewCard.svelte` component
2. Fetch metadata from Worker API during SSR
3. Implement error handling for failed images
4. Add CSS styling (Reddit/Twitter-style cards)
5. Mobile-responsive design

**Deliverables:**
- Link preview cards display correctly
- Graceful degradation for errors
- Mobile-optimized layout

### Phase 4: Optimization & Polish (Week 3)
**Priority: Low**

**Tasks:**
1. Implement rate limiting (prevent abuse)
2. Add loading skeletons for SSR
3. Prefetch link previews on post load
4. Monitor KV usage and costs
5. Performance testing and tuning

**Deliverables:**
- <500ms page load impact
- 85%+ cache hit rate
- Cost < $5/month for 10K users

---

## 6. Technical Specifications

### 6.1 URL Extraction Rules

**Include:**
- HTTP/HTTPS URLs only
- Exclude image markdown URLs (already handled)
- Exclude platform-specific URLs (twitter.com, facebook.com, etc.)
- First 3 URLs per post (limit for performance)

**Regex Pattern:**
```typescript
const urlPattern = /https?:\/\/(?!.*\.(jpg|jpeg|png|gif|webp|mp4|mov))[^\s<]+/gi;
```

### 6.2 Metadata Extraction Algorithm

```typescript
function extractMetadata(html: string): LinkPreview {
  const metadata = {
    title: extractOG('title') || extractTwitter('title') || extractTitle(),
    description: extractOG('description') || extractTwitter('description') || extractMeta('description'),
    image: extractOG('image') || extractTwitter('image'),
    siteName: extractOG('site_name'),
    favicon: extractFavicon() || `${baseUrl}/favicon.ico`
  };

  return metadata;
}
```

**Tag Priority:**
1. `<meta property="og:title">`
2. `<meta name="twitter:title">`
3. `<title>...</title>`

### 6.3 Performance Requirements

| Metric | Target | Critical |
|--------|--------|----------|
| API Response Time (cached) | <100ms | <200ms |
| API Response Time (uncached) | <2s | <5s |
| Cache Hit Rate | >85% | >70% |
| Metadata Extraction Success | >90% | >80% |
| Page Load Impact | <500ms | <1s |

### 6.4 Error Handling

**Scenarios:**
1. **URL unreachable**: Show URL as plain text link
2. **No metadata found**: Show domain + URL
3. **Image load failure**: Hide image, show text only
4. **Timeout (5s)**: Cache empty result, retry after 1 hour
5. **Rate limit**: Return cached or error message

### 6.5 Security Considerations

**SSRF Prevention:**
- Validate URL scheme (HTTP/HTTPS only)
- Block private IP ranges (10.0.0.0/8, 192.168.0.0/16, etc.)
- Limit redirect chains (max 3)
- Timeout after 5 seconds

**Content Security:**
- Sanitize HTML before parsing
- Validate image URLs
- Set CSP headers for preview images

---

## 7. Data Models

### PostData Interface (TypeScript)
```typescript
interface PostData {
  // ... existing fields
  linkPreviews?: LinkPreviewData[];
}

interface LinkPreviewData {
  url: string;
  metadata?: LinkPreviewMetadata; // Populated in share-web
}

interface LinkPreviewMetadata {
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  cachedAt?: string; // ISO timestamp
  error?: string;
}
```

### YAML Frontmatter
```yaml
---
platform: linkedin
archived: 2024-10-31T12:00:00Z
linkPreviews:
  - url: "https://techcrunch.com/article"
  - url: "https://github.com/project/repo"
---
```

### KV Store Structure
```typescript
// Key: preview:https://example.com
// Value:
{
  "url": "https://example.com",
  "title": "Example Site",
  "description": "This is an example site",
  "image": "https://example.com/og-image.jpg",
  "siteName": "Example",
  "favicon": "https://example.com/favicon.ico",
  "cachedAt": "2024-10-31T12:00:00Z"
}

// Expiration: 604800 seconds (7 days)
```

---

## 8. Testing Strategy

### Unit Tests
- [ ] URL extraction from various content formats
- [ ] Metadata parsing from different HTML structures
- [ ] Cache key generation and collision handling
- [ ] Error handling for edge cases

### Integration Tests
- [ ] Worker API endpoint responses
- [ ] KV cache read/write operations
- [ ] Plugin → Worker → KV flow
- [ ] Share-web SSR with preview data

### E2E Tests
- [ ] Archive post with URLs → Check YAML
- [ ] View shared post → Verify preview cards
- [ ] Handle failed image loads gracefully
- [ ] Mobile responsive display

### Performance Tests
- [ ] 100 concurrent API requests
- [ ] Cache hit rate under load
- [ ] Page load time impact measurement

---

## 9. Rollout Plan

### Week 1: Internal Testing
- Deploy Worker API to staging
- Test with 10 sample URLs
- Verify caching behavior
- Monitor costs and performance

### Week 2: Beta Release
- Enable for 50 beta users
- Collect feedback on preview quality
- Monitor error rates and edge cases
- Optimize based on real usage

### Week 3: Full Release
- Enable for all users
- Announce feature in release notes
- Monitor metrics (cache hit rate, costs, errors)
- Prepare hotfix pipeline

### Week 4: Optimization
- Analyze most common link domains
- Pre-cache popular sites
- Fine-tune cache TTL based on usage
- Implement advanced features (if needed)

---

## 10. Cost Analysis

### Cloudflare Workers
- **Free Tier**: 100,000 requests/day
- **Paid Tier**: $5/month for 10M requests/month
- **Expected**: <10,000 requests/month initially → **$0/month**

### Cloudflare KV
- **Reads**: 1M/month included (Free)
- **Writes**: 100K/month included (Free)
- **Storage**: 1GB included (Free)
- **Expected**: <50K writes/month, <500K reads/month → **$0/month**

### Total Monthly Cost Projection
| User Scale | Workers Cost | KV Cost | Total |
|------------|--------------|---------|-------|
| 100 users | $0 | $0 | **$0** |
| 1,000 users | $0 | $0 | **$0** |
| 10,000 users | $5 | $0 | **$5** |
| 100,000 users | $5 | $0 | **$5** |

---

## 11. Future Enhancements (Phase 2+)

### Advanced Features
1. **JavaScript Rendering** (using Cloudflare Browser)
   - Support for SPA sites (React, Vue apps)
   - Cost: +$5/month for Browser Rendering

2. **Screenshot Generation**
   - Visual preview of actual page
   - Storage in R2 (Cloudflare Object Storage)

3. **Video Previews**
   - Extract video thumbnails from YouTube, Vimeo
   - Show play buttons and duration

4. **PDF Previews**
   - Show first page thumbnail
   - Display document metadata

5. **Smart Domain Recognition**
   - Special handling for GitHub, YouTube, Twitter
   - Custom preview layouts per domain type

---

## 12. Success Criteria

### Must Have (Phase 1)
- ✅ 90%+ of links have metadata extracted
- ✅ Link preview cards display correctly
- ✅ No images/videos → show link previews
- ✅ Graceful error handling
- ✅ Mobile responsive
- ✅ <$5/month cost for 10K users

### Should Have (Phase 1)
- ✅ 85%+ cache hit rate
- ✅ <500ms page load impact
- ✅ Favicon display
- ✅ Domain extraction and display

### Nice to Have (Phase 2)
- ⏳ SPA site support
- ⏳ Screenshot generation
- ⏳ Video thumbnail extraction
- ⏳ Custom domain layouts

---

## 13. Open Questions & Decisions

### Q1: When to extract link previews?
**Decision**: Extract URLs during archive (plugin), fetch metadata on first view (share-web)
**Rationale**: Keeps YAML lightweight, metadata can be cached long-term

### Q2: How many links to preview per post?
**Decision**: First 3 URLs only
**Rationale**: Balance UX with performance, most posts have 1-2 links

### Q3: Should we support robots.txt?
**Decision**: Yes, respect robots.txt for ethical crawling
**Implementation**: Check `robots.txt` before fetching (optional Phase 2)

### Q4: How to handle paywalled content?
**Decision**: Extract whatever metadata is available, show "Login Required" if detected
**Implementation**: Detect common paywall indicators in HTML

---

## 14. Dependencies & Risks

### Dependencies
- Cloudflare Workers (runtime)
- Cloudflare KV (caching)
- marked.js (already used for markdown)
- Svelte 5 (already used in share-web)

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| High crawling costs | High | Aggressive KV caching (7-day TTL) |
| Slow external sites | Medium | 5s timeout, cache even on error |
| SSRF attacks | High | URL validation, block private IPs |
| Broken image links | Low | Graceful error handling, hide on fail |
| Metadata extraction fails | Medium | Fallback to URL/domain display |

---

## 15. Monitoring & Metrics

### Key Metrics to Track
1. **Link Preview Success Rate**: % of URLs with metadata extracted
2. **Cache Hit Rate**: % of requests served from KV
3. **API Response Time**: P50, P95, P99 latencies
4. **Error Rate**: % of failed extractions
5. **Monthly Cost**: Workers + KV usage
6. **User Engagement**: % of preview cards clicked

### Alerting Thresholds
- Error rate >15% → Investigate
- Cache hit rate <70% → Optimize TTL
- API P95 >5s → Check external site issues
- Monthly cost >$10 → Review usage patterns

---

## 16. Documentation Requirements

### Developer Documentation
- API endpoint specification (OpenAPI)
- Metadata extraction algorithm documentation
- Caching strategy guide
- Testing guide

### User Documentation
- Feature announcement in release notes
- FAQ: "Why don't some links have previews?"
- Privacy: "How are external sites accessed?"

---

## Appendix A: Example Metadata Extraction

### Example 1: TechCrunch Article
```html
<meta property="og:title" content="AI Startup Raises $50M" />
<meta property="og:description" content="Leading AI company secures funding..." />
<meta property="og:image" content="https://techcrunch.com/article.jpg" />
<meta property="og:site_name" content="TechCrunch" />
```

**Extracted:**
```json
{
  "title": "AI Startup Raises $50M",
  "description": "Leading AI company secures funding...",
  "image": "https://techcrunch.com/article.jpg",
  "siteName": "TechCrunch",
  "favicon": "https://techcrunch.com/favicon.ico"
}
```

### Example 2: GitHub Repository
```html
<meta property="og:title" content="username/repo" />
<meta property="og:description" content="A cool project description" />
<meta property="og:image" content="https://opengraph.githubassets.com/..." />
```

**Extracted:**
```json
{
  "title": "username/repo",
  "description": "A cool project description",
  "image": "https://opengraph.githubassets.com/...",
  "siteName": "GitHub",
  "favicon": "https://github.com/favicon.ico"
}
```

---

**Document Version**: 1.0
**Last Updated**: 2024-10-31
**Author**: Social Archiver Team
**Status**: Draft → Ready for Implementation
