# PRD: User Post Creation Feature for Social Archiver

## 1. Executive Summary

### Feature Overview
Enable users to create their own posts directly within the Obsidian plugin's Timeline View, similar to posting on Facebook or Instagram. Users can write posts with Markdown, attach images, and optionally share them publicly. This transforms Social Archiver from a read-only archiving tool into a full-featured social content platform.

### Business Value
- **User Engagement**: Increases daily active usage by allowing content creation, not just archiving
- **Platform Differentiation**: Unique value proposition combining Obsidian notes + social posting
- **Revenue Opportunity**: Pro users get unlimited posts with permanent sharing
- **Network Effects**: User-created posts drive more traffic to share-web platform
- **Long-term Vision**: Foundation for future standalone social platform (Phase 4: Web Version)

---

## 2. Goals & Background

### Primary Goals
1. Enable users to create posts with Markdown editor directly in Timeline View
2. Support image attachments (drag-drop, file picker, paste) up to 10 images per post
3. Store posts locally in Obsidian Vault with optional public sharing
4. Integrate seamlessly with existing Timeline rendering (platform: 'post')
5. Provide identical UX to major social platforms (Facebook, Instagram)

### Success Metrics
- **Adoption**: 30% of users create at least 1 post in first week
- **Engagement**: 50% of created posts have share enabled
- **Retention**: 70%+ monthly active users continue using post creation
- **Performance**: Post creation completion under 30 seconds
- **Error Rate**: <1% post creation failures

### Out of Scope (Phase 1)
- Video attachments (Phase 2)
- Rich text formatting toolbar (Phase 4)
- Scheduled posting (Phase 4)
- Post analytics/views (Phase 4)
- Comment system (Phase 4)
- Web version (Phase 4)

---

## 3. User Stories

### As an Obsidian user:
- I want to write quick thoughts/notes that I can optionally share publicly
- I want to use Markdown for formatting (bold, italic, lists, links)
- I want to attach images by dragging them into the editor
- I want my posts saved as Markdown files in my Vault
- I expect the composer to feel as natural as posting on Facebook

### As a content creator:
- I want to write long-form content with proper formatting
- I want to add multiple images with alt text for accessibility
- I want to preview how my post looks before publishing
- I want to control who can see my post (public vs private)
- I want to copy share URLs to promote on other platforms

### As a pro user:
- I want permanent sharing (no 30-day expiry)
- I want password protection for sensitive posts
- I want to track which posts I've shared publicly
- I expect seamless integration with existing archived posts

---

## 4. Technical Architecture

### 4.1 Data Flow

```
┌──────────────────┐
│  Timeline View   │ (User clicks composer)
└────────┬─────────┘
         │ 1. Expand PostComposer
         ↓
┌──────────────────┐
│ Tiptap Editor    │ (User writes content)
│ + MediaAttacher  │ (User adds images)
└────────┬─────────┘
         │ 2. Click "Post" button
         ↓
┌──────────────────┐
│ PostPublisher    │
└────────┬─────────┘
         │ 3. Save to Vault
         ├─ vault.create(markdown)
         └─ vault.createBinary(images)
         │
         │ 4. If share enabled
         ↓
┌──────────────────┐
│  Workers API     │ POST /api/share
└────────┬─────────┘
         │ 5. Store in KV
         ↓
┌──────────────────┐
│   Share-web      │ Render at /{username}
└──────────────────┘
```

### 4.2 Component Architecture (SRP)

```typescript
// UI Layer
PostComposer          // Main container (collapsed/expanded states)
  ├─ MarkdownEditor   // Tiptap WYSIWYG editor
  ├─ MediaAttacher    // Drag-drop, file picker, paste handlers
  ├─ MediaGrid        // Image preview grid (reorder, delete, alt text)
  ├─ ShareOptions     // Toggle, password, expiry settings
  └─ ActionButtons    // Cancel, Save Draft, Post

// Service Layer
PostCreationService   // Business logic (PostData generation)
VaultStorageService   // Vault operations (file/folder creation)
MediaHandler          // Image optimization, resizing
ShareAPIClient        // Workers API integration

// Data Layer
PostData              // Unified data structure (platform: 'post')
YamlFrontmatter       // Metadata storage
```

### 4.3 Storage Structure

**File Path**:
```
Social Archives/Posts/{YYYY}/{MM}/{YYYY-MM-DD-HHMMSS}.md

Example:
Social Archives/Posts/2024/03/2024-03-15-143052.md
```

**Media Path**:
```
attachments/social-archives/post/{YYYY-MM-DD}/{filename}

Example:
attachments/social-archives/post/2024-03-15/image-1710504123456.png
```

**File Format**:
```markdown
---
platform: post
author:
  name: "User Display Name"
  handle: "@username"
  avatar: "avatar-url"
timestamp: 2024-03-15T14:30:52Z
share: true
shareUrl: "https://social-archive.junlim.org/username/abc123"
shareId: "abc123"
tags: [personal, thoughts]
---

Post content with **Markdown** formatting.

Links work: https://example.com

![[image-attachment.png]]
```

### 4.4 Platform Type Extension

```typescript
// workers/src/types/post.ts
export type Platform =
  | 'facebook'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'youtube'
  | 'reddit'
  | 'post'; // ✨ NEW
```

---

## 5. Implementation Phases

### Phase 1: MVP (Week 1-2)
**Goal**: Basic post creation with local storage

- [ ] PostComposer UI (collapsed/expanded states)
- [ ] Tiptap editor integration
  - StarterKit, Markdown, Placeholder, Image, Link extensions
  - Character counter (10,000 max)
  - Auto-link detection
- [ ] Image attachment (drag-drop, file picker)
- [ ] Vault storage (markdown + images)
- [ ] Basic share integration (no password/expiry)
- [ ] Timeline rendering (platform: 'post' posts)

**Dependencies**:
```json
{
  "@tiptap/core": "^3.4.3",
  "@tiptap/starter-kit": "^3.4.3",
  "@tiptap/extension-placeholder": "^3.4.3",
  "@tiptap/extension-image": "^3.4.3",
  "@tiptap/extension-link": "^3.4.3",
  "tiptap-markdown": "^0.9.0"
}
```

**Testing**:
- Unit: PostCreationService, VaultStorageService
- Integration: PostComposer + Editor + MediaAttacher
- E2E: Create post → Save → Render in Timeline

### Phase 2: Enhanced Features (Week 3-4)
**Goal**: Polish UX and add advanced features

- [ ] Link preview generation (reuse existing system)
- [ ] Share options (password, custom expiry)
- [ ] Draft auto-save (localStorage, 1-minute interval)
- [ ] Image optimization (max 2048x2048, WebP conversion)
- [ ] Media grid (reorder, alt text, delete)
- [ ] Offline support (save as draft, sync later)
- [ ] Credits system integration

**Testing**:
- Performance: Image optimization benchmarks
- UX: Draft recovery after browser crash
- Security: Share password hashing

### Phase 3: Polish (Week 5)
**Goal**: Mobile, accessibility, i18n

- [ ] Mobile optimization (touch targets 44px, full-screen modal)
- [ ] Keyboard shortcuts (Cmd+Enter to post, Esc to cancel)
- [ ] Error handling (network, quota, validation)
- [ ] Performance optimization (debounced link detection)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] i18n (English, Korean)

**Testing**:
- Mobile: iOS Safari, Android Chrome
- Accessibility: Screen reader testing
- Performance: <100ms interaction time

### Phase 4: Web Version & Advanced (Future)
**Goal**: Extend to share-web, add advanced features

**Web Version**:
- [ ] Storage Layer abstraction (IPostStorage interface)
- [ ] share-web PostComposer (SvelteKit + Tiptap)
- [ ] Authentication system (Gumroad license)
- [ ] Media upload API (POST /api/media → R2 Storage)
- [ ] Mobile-responsive web composer

**Advanced Features**:
- [ ] Video attachment (MP4, MOV, 100MB max)
- [ ] AI content suggestions
- [ ] Scheduled posting
- [ ] Post analytics (views, likes)
- [ ] Comment system
- [ ] Rich text formatting toolbar

---

## 6. UI/UX Design

### 6.1 Collapsed State (Initial)
```
┌─────────────────────────────────────────────────────┐
│  [Avatar] What's on your mind?       [📷] [Share]   │
└─────────────────────────────────────────────────────┘
```
- Height: 60px
- Click anywhere to expand
- Facebook-style placeholder

### 6.2 Expanded State (Editing)
```
┌───────────────────────────────────────────────────────────┐
│  [Avatar]  [Markdown Editor]                              │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │ Supporting **bold**, _italic_, and [[links]]      │    │
│  │                                                     │    │
│  │ https://example.com                                │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  [Link Preview Card - if URL detected]                     │
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐                                  │
│  │ Img │ │ Img │ │ Img │  [+ Add more]                    │
│  └─────┘ └─────┘ └─────┘                                  │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│  📷 Add images  |  🔗 Add link  |  #️⃣ Add tags            │
│                                                             │
│  [ ] Share publicly     [ ] Password protect              │
│                                                             │
│  [Cancel]                           [Save Draft] [Post]    │
│                                    0/10,000 characters     │
└───────────────────────────────────────────────────────────┘
```

### 6.3 Mobile Optimization
- Full-screen modal on mobile
- Touch targets: 44x44px minimum
- Image grid: 2 columns on mobile, 3-4 on desktop
- Keyboard auto-scrolls composer into view

---

## 7. Success Metrics & KPIs

### Adoption Metrics
- **Week 1**: 30% users create ≥1 post
- **Month 1**: 50% users create ≥5 posts
- **Month 3**: 70% retention (continue using)

### Engagement Metrics
- 50% posts have share enabled
- Average 3 images per post
- 2,000 characters average post length

### Performance Metrics
- Post creation: <30 seconds end-to-end
- Image upload: <2 seconds per image
- Timeline render: <100ms additional latency
- Error rate: <1% post failures

### Business Metrics
- **Credits Usage**: Average 1 credit per post (share enabled)
- **Pro Conversion**: 10% free users upgrade for permanent sharing
- **Share Traffic**: 20% increase in share-web monthly visits

---

## 8. Risk & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Tiptap performance with large posts | High | Medium | Implement virtual scrolling, character limit |
| Vault quota exceeded | High | Low | Show quota warning, compress images |
| Share API rate limiting | Medium | Medium | Implement client-side retry with backoff |
| Image optimization slow | Medium | Low | Run optimization in Web Worker |

### UX Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users lose unsaved drafts | High | Medium | Auto-save to localStorage every 1 minute |
| Confusing collapsed/expanded state | Medium | Low | Clear visual feedback, smooth animation |
| Mobile keyboard covers editor | High | High | Auto-scroll to keep cursor in view |
| Share URL confusion | Medium | Medium | Clear copy-to-clipboard feedback |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low adoption rate | High | Low | User onboarding tutorial, prominent placement |
| High storage costs (R2) | Medium | Low | Implement aggressive image compression |
| Content moderation issues | High | Low | Phase 1: local-only, Phase 4: add moderation |

---

## 9. Dependencies

### Internal Dependencies
- **Link Preview System**: Reuse for URL detection
- **Share API**: Existing POST /api/share endpoint
- **Timeline Rendering**: PostCard component supports platform: 'post'
- **Credits System**: Integrate with Gumroad license verification

### External Dependencies
- **Tiptap**: Editor library (npm package)
- **Obsidian Vault API**: File operations
- **Cloudflare Workers**: Share API hosting
- **Cloudflare KV**: Share metadata storage

### Code Reference
- **korean-grammar-svelte**: Tiptap implementation patterns
  - `TipTapMarkdownEditor.svelte`: Editor initialization
  - `ReadingModeToolbar.svelte`: Toolbar UI patterns
  - Markdown serialization: `editor.storage.markdown.getMarkdown()`

---

## 10. Open Questions

1. **Draft Syncing**: Should drafts sync across devices via Workers KV?
   - **Decision**: Phase 2, requires authentication system

2. **Post Editing**: Can users edit posts after publishing?
   - **Decision**: Phase 1 supports edit (just re-save file), but shared version is immutable

3. **Post Deletion**: What happens to shared URLs when Vault file is deleted?
   - **Decision**: Share remains active (user must explicitly "unshare" via plugin)

4. **Character Limit**: Should we match Instagram (2,200) or allow more (10,000)?
   - **Decision**: 10,000 to support long-form content

5. **Image Optimization**: Client-side (browser Canvas API) or server-side (Workers)?
   - **Decision**: Client-side for Phase 1 (immediate feedback), server-side for Phase 4

---

## 11. Future Enhancements (Post Phase 4)

### Standalone Social Platform ("Very Very Social")
- Independent web app (not Obsidian plugin)
- User authentication (email/password, OAuth)
- Follow/follower system
- Feed algorithm (chronological + recommended)
- Notifications
- Mobile apps (iOS, Android)

### Advanced Editor Features
- Collaborative editing (real-time, Yjs CRDT)
- Voice-to-text dictation
- AI writing assistant (tone adjustment, grammar)
- Template library (daily journal, book review, etc.)

### Analytics & Insights
- Post views/likes breakdown
- Best-performing content
- Audience demographics
- Engagement trends

---

## 12. Appendix

### A. Technical Spec Reference
See detailed implementation specs: `workers/SPEC_USER_POST_CREATION.md`

### B. Obsidian API Constraints
- `Editor` API only works in `MarkdownView` (not custom views)
- Mobile: No Node.js/Electron APIs
- Use `Platform.isMobile` for feature detection
- Vault operations are async (all return Promise)

### C. Tiptap Extension Configuration
```typescript
new Editor({
  extensions: [
    StarterKit,
    Markdown,                              // tiptap-markdown
    Placeholder.configure({
      placeholder: "What's on your mind?"
    }),
    Image,                                 // Image nodes
    Link.configure({
      openOnClick: false,
      autolink: true                       // Auto-detect URLs
    })
  ],
  editorProps: {
    attributes: {
      class: 'tiptap-editor-content',
      spellcheck: 'false'
    },
    clipboardTextSerializer: (slice) => {
      // Serialize to Markdown on copy
      return editor.storage.markdown.serializer.serialize(slice.content);
    }
  }
})
```

### D. Cost Estimate

**Phase 1-3 (Obsidian Plugin Only)**:
- Development: 5 weeks × $0/hour (self-developed)
- Infrastructure: $0 (uses existing Workers/KV)
- Additional Cost: $0

**Phase 4 (Web Version)**:
- R2 Storage: ~$5-10/month (1000 users, 10MB avg per user)
- KV Writes: Free tier (100k/day sufficient)
- Workers Requests: Free tier (100k/day sufficient)
- Total: $5-10/month

---

**Document Version**: 1.0
**Last Updated**: 2024-10-31
**Author**: Claude Code + User
**Status**: Ready for Implementation
