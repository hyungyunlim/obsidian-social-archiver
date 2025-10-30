# Public Timeline Feature - Product Requirements Document

## Document Information
- **Created**: 2025-01-29
- **Status**: Draft
- **Priority**: High
- **Target Release**: Phase 1 - 3 weeks from start

---

## Executive Summary

Enable Social Archiver users to share their entire timeline of archived social media posts as a public website, creating a personal archive showcase. This feature transforms the plugin from a private archiving tool into a platform for public knowledge sharing.

**Strategic Approach**: Hybrid implementation strategy
- **Phase 1** (2-3 weeks): Workers SSR for rapid MVP and validation - **PRIMARY FOCUS**
- **Phase 2** (Future, if needed): Optional migration to Astro SSG for enhanced performance

---

## Problem Statement

### Current State
- ✅ Users can archive social media posts to Obsidian vault
- ✅ Timeline View works perfectly within the plugin (recently refactored, SRP compliant)
- ✅ Individual posts can be shared via `/share/:id` endpoint
- ❌ No way to share entire timeline publicly
- ❌ ShareManager backend exists but no UI to create shares
- ❌ R2 media storage configured but upload logic missing

### User Needs
1. **Content Creators**: Share curated social media archives as portfolio
2. **Researchers**: Publish archived threads for public reference
3. **Archivists**: Create public timelines of important social movements
4. **Personal Users**: Share favorite archived posts with friends/family

### Business Goals
- Differentiate from Obsidian Publish (social-focused vs. wiki-focused)
- Drive Pro tier conversions (permanent timelines + custom domains)
- Validate market demand before heavy investment (Phase 1 MVP approach)

---

## Phase 1: Workers Server-Side Rendering (PRIMARY IMPLEMENTATION)

### Overview
Extend existing Cloudflare Workers infrastructure to render timeline pages dynamically using server-side HTML generation, following the proven pattern from `public-share.ts`.

### Why Phase 1 First?
- ✅ **Fast to Market**: 2-3 weeks vs 6+ weeks for Astro
- ✅ **Code Reuse**: 90% leverage of existing patterns
- ✅ **Low Risk**: Proven public-share.ts architecture
- ✅ **Real-time Updates**: No build delays (user shares → live in 5 seconds)
- ✅ **Resource Efficiency**: Can develop alongside Task #9 (AI Features)
- ✅ **Simple Infrastructure**: No build pipelines, no GitHub Actions

### Architecture

```
┌─────────────────────┐
│  Obsidian Plugin    │
│  Share Timeline UI  │
└──────────┬──────────┘
           │ POST /api/timeline/publish
           ▼
┌─────────────────────────────┐
│  Cloudflare Workers         │
│                             │
│  1. Validate license        │
│  2. Upload media to R2      │
│  3. Store metadata in KV    │
│  4. Return share URL        │
└──────────┬──────────────────┘
           │
           │ GET /share/:username
           ▼
┌─────────────────────────────┐
│  Timeline Renderer (SSR)    │
│                             │
│  1. Fetch from KV           │
│  2. Generate HTML           │
│  3. Inject CSS/JS           │
│  4. Return to browser       │
└─────────────────────────────┘
```

### Core Features

#### 1. Public Timeline Page (`/share/:username`)

**Layout Components**:
- **Header Section**
  - Username display
  - Bio/description (optional, Pro feature)
  - Statistics (post count, view count)
  - Theme toggle (dark/light, Pro feature)

- **Timeline Feed**
  - Single-column layout (max-width: 672px, matching plugin)
  - Post cards with platform-specific styling
  - Infinite scroll or pagination (100 posts per page)
  - Filter by platform (Facebook, Instagram, etc.)
  - Sort by date (newest/oldest)

- **Footer**
  - "Powered by Social Archiver" link
  - Disclaimer about archived content
  - Copyright notice

**Post Card Structure** (reuse TimelineContainer patterns):
- Platform icon + author info
- Relative timestamps ("2h ago", "Yesterday")
- Post content (text/HTML)
- Media gallery (images/videos from R2)
- Interaction counts (likes, comments, shares)
- Link to original post

#### 2. Plugin Integration - Share Timeline UI

**New Modal**: `ShareTimelineModal.ts`
- Username input (validation: alphanumeric + hyphens only)
- Theme selection (dark/light)
- Bio textarea (Pro only, 280 chars max)
- Advanced options (collapsible):
  - Platform filters (which platforms to include)
  - Date range (Pro only)
  - Custom CSS (Pro only)
- "Share Timeline" button
- Preview of share URL: `https://share.social-archiver.com/{username}`

**Settings Integration**:
- New section: "Timeline Sharing"
- Toggle: "Enable timeline sharing"
- Default theme preference
- Username availability check
- List of active shares with management (delete, regenerate)

#### 3. API Endpoints

**POST `/api/timeline/publish`**
```typescript
Request:
{
  username: string;
  posts: PostData[];      // From vault
  settings: {
    theme: 'dark' | 'light';
    bio?: string;
    customCSS?: string;    // Pro only
    platformFilters?: Platform[];
  };
  tier: 'free' | 'pro';
}

Response:
{
  success: true;
  data: {
    shareId: string;
    shareUrl: string;
    expiresAt: number;     // Free: 30 days, Pro: 365 days
  }
}
```

**GET `/share/:username`**
- Fetch timeline data from KV
- Check expiration (free tier only)
- Increment view count
- Render HTML using Hono html`` template
- Return with cache headers (`Cache-Control: public, max-age=300`)

**DELETE `/api/timeline/:username`**
- Require license key authentication
- Delete timeline from KV
- Clean up R2 media (mark for deletion)
- Return success confirmation

#### 4. R2 Media Upload Implementation

**New Service**: `R2MediaUploader.ts`
```typescript
export class R2MediaUploader implements IService {
  async uploadMedia(
    media: Media,
    username: string
  ): Promise<string>;

  async uploadBatch(
    mediaList: Media[],
    username: string
  ): Promise<string[]>;

  async deleteUserMedia(username: string): Promise<void>;

  generateMediaUrl(username: string, filename: string): string;
}
```

**Storage Structure**:
```
R2 Bucket: social-archiver-media
├── timelines/
│   └── {username}/
│       ├── {postId}_image1.jpg
│       ├── {postId}_image2.jpg
│       └── {postId}_video.mp4
```

**Upload Flow**:
1. Plugin reads media from vault `attachments/` folder
2. Converts to base64 or streams to Workers
3. Workers uploads to R2 with optimized filenames
4. Returns public R2 URLs
5. URLs stored in KV timeline metadata

#### 5. Data Models

**KV Storage Schema**:
```typescript
// Key: "timeline:{username}"
interface TimelineData {
  username: string;
  posts: PostData[];      // Full post data
  settings: {
    theme: 'dark' | 'light';
    bio?: string;
    customCSS?: string;
    platformFilters?: Platform[];
  };
  tier: 'free' | 'pro';
  expiresAt?: number;     // Unix timestamp
  viewCount: number;
  createdAt: number;
  lastUpdated: number;
  mediaUrls: string[];    // R2 URLs for cleanup
}
```

**Plugin Side**:
```typescript
// Reuse existing ShareManager
interface TimelineShareRequest {
  username: string;
  includeArchived: boolean;  // Include archived posts
  includeLiked: boolean;     // Only liked posts
  platformFilters?: Platform[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}
```

### Implementation Tasks (Phase 1)

#### Week 1: Workers Backend
1. **Create Timeline Renderer** (`workers/src/handlers/public-timeline.ts`)
   - GET `/share/:username` endpoint
   - HTML template generation (reuse public-share.ts styles)
   - Post card rendering function
   - Media gallery rendering
   - Theme switching logic

2. **Create Timeline API** (`workers/src/handlers/timeline-api.ts`)
   - POST `/api/timeline/publish` endpoint
   - Username validation (uniqueness, format)
   - License tier verification
   - KV storage logic
   - R2 media upload orchestration

3. **Implement R2 Uploader** (`workers/src/services/R2MediaUploader.ts`)
   - Upload single media file
   - Batch upload optimization
   - Error handling and retry logic
   - Media URL generation
   - Cleanup/deletion logic

4. **Update KV Storage Adapter** (`workers/src/services/KVStorageAdapter.ts`)
   - Add `saveTimeline()` method
   - Add `getTimeline()` method
   - Add `updateTimelineMetadata()` method
   - Add `deleteTimeline()` method
   - Add `listUserTimelines()` for admin

#### Week 2: Plugin Integration
1. **Create Share Timeline Modal** (`src/modals/ShareTimelineModal.ts`)
   - Modal UI with form fields
   - Username validation (client-side)
   - Theme selector
   - Bio textarea (Pro only)
   - Platform filter checkboxes
   - API integration (POST /api/timeline/publish)
   - Success notification with URL
   - Copy to clipboard functionality

2. **Update Settings Tab** (`src/settings/SettingsTab.ts`)
   - Add "Timeline Sharing" section
   - Enable/disable toggle
   - Active shares list with delete buttons
   - Default theme preference
   - Link to share modal

3. **Add Command** (`src/main.ts`)
   - Register command: "Share Timeline"
   - Command palette integration
   - Ribbon icon (optional)

4. **Extend ShareManager** (`src/services/ShareManager.ts`)
   - Add `createTimelineShare()` method
   - Add timeline-specific validation
   - Add media preparation logic
   - Add API request builder

#### Week 3: Testing & Polish
1. **Unit Tests**
   - R2MediaUploader tests with mocks
   - Timeline renderer tests
   - API endpoint tests
   - ShareManager tests

2. **Integration Tests**
   - End-to-end share flow
   - Media upload pipeline
   - License validation
   - Expiration logic

3. **Manual Testing**
   - Test with 1 post
   - Test with 100 posts
   - Test with 1000 posts (performance)
   - Test media upload (images, videos)
   - Test all platforms
   - Test free vs pro features
   - Mobile responsiveness
   - Dark/light theme switching

4. **Documentation**
   - User guide: How to share timeline
   - API documentation
   - Troubleshooting guide
   - Privacy and copyright notices

### Technical Specifications

#### Performance Targets
- Timeline render time: < 500ms for 100 posts
- R2 media upload: < 5s for 10 images
- KV write latency: < 100ms
- HTML response size: < 500KB (uncompressed)
- Lighthouse score: 70+ (acceptable for SSR)

#### Caching Strategy
```typescript
// Edge caching
{
  'Cache-Control': 'public, max-age=300, s-maxage=300',  // 5 min
  'CDN-Cache-Control': 'max-age=300',
  'Vary': 'Accept-Encoding'
}

// KV caching (automatic)
// Browser caching for static assets
```

#### Security Measures
- **Rate Limiting**: 10 publishes per user per day
- **Username Squatting Prevention**: Reserve common names
- **Content Moderation**: Flag potentially harmful content
- **CORS**: Restrict API origins
- **CSP Headers**: Prevent XSS attacks
- **Input Sanitization**: Escape HTML in posts

#### Error Handling
```typescript
// Standard error responses
{
  success: false,
  error: {
    code: 'USERNAME_TAKEN' | 'INVALID_LICENSE' | 'QUOTA_EXCEEDED' | 'UPLOAD_FAILED',
    message: 'User-friendly error message',
    details?: any  // Debug info (non-production)
  }
}
```

### Free vs Pro Features

| Feature | Free | Pro |
|---------|------|-----|
| Timeline Sharing | ✅ 30-day expiry | ✅ Permanent (365 days) |
| Share URL | `share.social-archiver.com/{user}` | ✅ + Custom domain |
| Theme | ✅ Dark only | ✅ Dark + Light |
| Bio | ❌ | ✅ 280 chars |
| Custom CSS | ❌ | ✅ Full customization |
| Platform Filters | ❌ | ✅ |
| Date Range | ❌ | ✅ |
| Media Storage | 100MB | 1GB |
| Analytics | ❌ | ✅ View stats |

### Success Metrics (Phase 1)
- 50+ users create timeline shares in first month
- 10+ convert to Pro for permanent timelines
- < 5% error rate in share creation
- Average load time < 500ms
- 80%+ mobile satisfaction (user survey)

---

## Phase 1.5: Public Explore Feed (FUTURE CONSIDERATION)

### Overview
After validating Phase 1 with individual timeline sharing, consider adding a public discovery feed where users can opt-in to showcase their timelines to the broader community.

### Concept: `/explore` - Public Timeline Discovery
A central feed aggregating public timelines for discovery and community building, similar to:
- Mastodon's Federated Timeline
- Medium's Explore page
- Reddit's r/all

### Why Phase 1.5 (Not Phase 1)?
- ✅ **Validation First**: Need to prove individual timeline value before community features
- ✅ **Moderation Complexity**: Public feed requires content moderation infrastructure
- ✅ **Focus**: Keep Phase 1 scope tight for faster delivery
- ✅ **Risk Management**: Test waters with private sharing before public exposure

### Technical Approach (When Ready)

**KV Index Structure**:
```typescript
// Public visibility index
"index:public:latest" → ["user1", "user2", ...] // Latest 100 users
"index:public:popular" → ["user3", "user1", ...] // By view count
"index:platform:instagram" → ["user1", ...] // Platform-specific

// Individual timeline metadata (extend existing)
"timeline:username" → {
  ...existingFields,
  publicVisibility: boolean,  // Opt-in flag
  exploreStats: {
    featured: boolean,
    lastFeaturedAt: timestamp
  }
}
```

**New Endpoints**:
- `GET /explore` - Public timeline feed
- `GET /explore/latest` - Latest public timelines
- `GET /explore/popular` - Most viewed timelines
- `GET /explore/[platform]` - Platform-specific feeds

**UI Changes**:
- ShareTimelineModal: Add "Show in public feed" toggle (Pro only)
- Explore page: Grid/list view of public timelines with preview cards

### Success Triggers (When to Implement)
Only proceed with Phase 1.5 if Phase 1 achieves:
1. ✅ 100+ active timeline shares
2. ✅ 20+ Pro users (moderation resources justifiable)
3. ✅ User requests for discovery features
4. ✅ Content moderation plan in place
5. ✅ 2-week development window available

### Architecture Considerations (Now)
Design Phase 1 with extensibility in mind:
- **KV Schema**: Include `publicVisibility: false` field (default private)
- **Timeline API**: Support future `publicVisibility` parameter
- **Indexing**: Store timestamps for future "latest" sorting
- **Rate Limiting**: Build foundation that can scale to public feed

### Estimated Effort
- **Design & Planning**: 1 week
- **Implementation**: 2 weeks
- **Moderation Tools**: 1 week
- **Total**: ~4 weeks (after Phase 1 success)

### Risks & Mitigations
- **Risk**: Spam and abuse in public feed
  - **Mitigation**: Pro-only feature initially, require minimum timeline quality
- **Risk**: Copyright/legal issues with public exposure
  - **Mitigation**: Clear ToS, DMCA process, user reporting
- **Risk**: Scaling issues with popular feed
  - **Mitigation**: Start with simple latest feed, add pagination

### Decision: Deferred to Post-Phase 1
- Focus on individual timeline sharing (Phase 1)
- Collect user feedback and usage patterns
- Reassess after 60-90 days of Phase 1 operation
- Document as future enhancement in roadmap

---

## Phase 2: Astro Static Site Generation (OPTIONAL FUTURE)

### When to Consider Migration
Only proceed with Phase 2 if:
1. ✅ Phase 1 validated with 100+ active timeline shares
2. ✅ SEO becomes critical business requirement
3. ✅ Performance bottlenecks appear (> 1000 posts per timeline)
4. ✅ Rich client-side interactions needed
5. ✅ Resources available (6 weeks dedicated work)

### High-Level Approach
- Create `packages/web` with Astro project
- Implement build pipeline (GitHub Actions)
- Generate static pages at build time
- Deploy to Cloudflare Pages
- Gradual migration: new users → Astro, existing users → Workers

### Decision Point
**Trigger**: When Phase 1 metrics show:
- Average timeline size > 500 posts
- SEO-driven traffic potential identified
- User requests for advanced UI features
- Workers SSR performance degradation

**Do NOT migrate if**:
- Phase 1 works fine for current use cases
- SEO not critical (privacy-first positioning)
- Development resources limited
- Build pipeline adds unwanted complexity

---

## Implementation Checklist

### Pre-Development
- [ ] Review existing `public-share.ts` implementation
- [ ] Design database schema (KV structure)
- [ ] Design R2 storage structure
- [ ] Create Figma mockups (optional)
- [ ] Get user feedback on mockups

### Phase 1 Development (2-3 weeks)
**Week 1: Backend**
- [ ] Create `public-timeline.ts` router
- [ ] Create `timeline-api.ts` router
- [ ] Implement `R2MediaUploader` service
- [ ] Update `KVStorageAdapter` for timeline storage
- [ ] Write unit tests for new services

**Week 2: Frontend**
- [ ] Create `ShareTimelineModal` component
- [ ] Update `SettingsTab` with timeline section
- [ ] Extend `ShareManager` service
- [ ] Add command palette integration
- [ ] Write unit tests for modal

**Week 3: Testing & Launch**
- [ ] Integration tests (end-to-end)
- [ ] Manual testing across platforms
- [ ] Performance testing (100, 500, 1000 posts)
- [ ] Mobile testing (iOS, Android)
- [ ] Documentation writing
- [ ] Beta testing with 10 users
- [ ] Production deployment
- [ ] Monitor metrics for 2 weeks

### Post-Launch
- [ ] Collect user feedback
- [ ] Analyze usage metrics
- [ ] Identify performance bottlenecks
- [ ] Plan optimization iterations
- [ ] Decide on Phase 2 migration (if needed)

---

## Technical Risks & Mitigations

### Risk 1: R2 Upload Performance
**Risk**: Large media files slow down share creation
**Mitigation**:
- Implement parallel uploads
- Show progress bar to user
- Compress images before upload
- Limit total media size (100MB free, 1GB pro)

### Risk 2: KV Size Limits
**Risk**: Large timelines exceed KV value size (25MB)
**Mitigation**:
- Store posts in separate KV keys: `timeline:{user}:posts:{page}`
- Store metadata separately: `timeline:{user}:meta`
- Implement pagination server-side

### Risk 3: Workers CPU Limits
**Risk**: Rendering 1000 posts exceeds 50ms CPU time
**Mitigation**:
- Implement pagination (100 posts per page)
- Use streaming responses
- Optimize HTML template generation
- Cache rendered HTML in KV (5 min TTL)

### Risk 4: Username Squatting
**Risk**: Bad actors reserve popular usernames
**Mitigation**:
- Require active Obsidian vault with posts
- Rate limit username changes
- Reserve common names (admin, support, api, etc.)
- Implement username trading/reclaim policy

### Risk 5: Content Moderation
**Risk**: Harmful content shared publicly
**Mitigation**:
- Add report functionality
- Implement content scanning (future)
- Clear terms of service
- Quick takedown process
- User reputation system

---

## Dependencies

### Technical Dependencies
- ✅ Cloudflare Workers (already deployed)
- ✅ Cloudflare KV (already configured)
- ✅ Cloudflare R2 (configured, not used yet)
- ✅ Hono framework (already in use)
- ✅ ShareManager service (already exists)
- ✅ TimelineContainer logic (already refactored)

### External Dependencies
- License validation (Gumroad API) - already working
- Media hosting (R2) - need to implement upload logic

### Team Dependencies
- None (solo developer can complete Phase 1)

---

## Open Questions

### Product Questions
1. Should free tier allow any timeline sharing, or require 1 Pro post first?
   - **Decision**: Allow free with 30-day expiry to drive conversions

2. How to handle username conflicts?
   - **Decision**: First-come-first-served + reclaim policy for inactive users

3. Should we allow embedding timelines in other sites (iframe)?
   - **Decision**: Phase 2 feature, not MVP

### Technical Questions
1. How to handle timeline updates? (user adds new post)
   - **Decision**: Manual re-publish (button in modal), auto-sync in Phase 2

2. Should we cache rendered HTML?
   - **Decision**: Yes, 5-minute edge cache + 1-hour KV cache

3. How to handle deleted posts?
   - **Decision**: Timeline is snapshot at publish time, not live sync

---

## Success Criteria

### Phase 1 Launch Criteria
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed on 3 platforms
- [ ] Documentation complete
- [ ] 10 beta users successfully create shares
- [ ] Performance targets met (< 500ms render)
- [ ] Zero critical bugs

### Phase 1 Success Metrics (30 days post-launch)
- 50+ timeline shares created
- 10+ Pro conversions attributed to timeline feature
- < 5% error rate
- 80%+ user satisfaction (survey)
- < 3 support tickets per week

### Phase 2 Consideration Criteria (90 days)
- 200+ active timeline shares
- SEO traffic potential identified
- User requests for advanced features
- Performance degradation observed

---

## Appendix

### A. Code References

**Existing files to reference**:
- `workers/src/handlers/public-share.ts` - HTML rendering pattern
- `src/components/timeline/TimelineContainer.ts` - Timeline logic
- `src/services/ShareManager.ts` - Share management patterns
- `src/components/timeline/renderers/PostCardRenderer.ts` - Post card HTML

**New files to create**:
- `workers/src/handlers/public-timeline.ts`
- `workers/src/handlers/timeline-api.ts`
- `workers/src/services/R2MediaUploader.ts`
- `src/modals/ShareTimelineModal.ts`
- `src/services/TimelineShareManager.ts` (extends ShareManager)

### B. UI Mockup Notes

**Timeline Page Layout**:
```
┌─────────────────────────────────────┐
│           Header                     │
│  username                            │
│  bio                                 │
│  📊 50 posts | 👁️ 1.2K views       │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Filters: [All] [Instagram] [X]...  │
│  Sort: [Newest First ▼]             │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Post Card 1                         │
│  🔵 @johndoe · 2h ago               │
│  Post content here...                │
│  [Image Gallery]                     │
│  ❤️ 45  💬 12  🔁 3                 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Post Card 2                         │
│  ...                                 │
└─────────────────────────────────────┘
```

### C. Privacy & Legal Considerations

**Disclaimer (Required on all timeline pages)**:
```
⚠️ Disclaimer: This content was archived from social media platforms.
Archive only content you have permission to save and share.
Original copyright belongs to the content creator.
```

**Terms of Service**:
- Users responsible for copyright compliance
- Platform can remove content upon DMCA request
- No guarantee of permanent availability (even Pro tier)
- Privacy-first: noindex by default

**Data Retention**:
- Free tier: 30 days after expiry
- Pro tier: 365 days after expiry
- Deleted by user: immediate removal
- Inactive users: 90 days notice before cleanup

### D. Future Enhancements (Post-Phase 1)

**Quick Wins**:
- [ ] Timeline RSS feed
- [ ] JSON API for timeline data
- [ ] Embeddable widget (iframe)
- [ ] Custom subdomain (pro.username.archiver.app)

**Medium-term** (Phase 1.5):
- [ ] **Public Explore Feed** (`/explore`) - See Phase 1.5 section
- [ ] Timeline analytics dashboard
- [ ] Content search within timeline
- [ ] Multiple timelines per user (collections)
- [ ] Collaborative timelines

**Long-term** (Phase 2+):
- [ ] ActivityPub integration (Phase 2.5)
- [ ] Custom domain support
- [ ] API for third-party apps
- [ ] Migration to Astro SSG (if needed)

---

**Document Version**: 1.1
**Last Updated**: 2025-01-29
**Changelog**:
- v1.1: Added Phase 1.5 (Public Explore Feed) as future consideration
- v1.0: Initial PRD with Phase 1 (Workers SSR) and Phase 2 (Astro SSG)

**Next Review**: After Phase 1 completion
