# PRD: Archive Modal Share Integration

## Overview
Add "Share to Web" option directly in the Archive Modal, allowing users to publish posts to the web simultaneously with archiving to Vault. This eliminates the need for a separate share action after archiving.

## Problem Statement
Current workflow requires two separate actions:
1. Archive Modal → Save to Vault
2. Timeline View → Click Share → Publish to Web

This creates friction for users who know they want to share content publicly from the start.

## Solution
Add a simple "Share to Web" toggle in Archive Modal that triggers parallel archiving and web publishing.

## User Flow

### Current Flow (2 steps)
```
User → Archive Modal → Enter URL → Archive → Close
User → Timeline View → Find Post → Click Share → Confirm → Web Published
```

### New Flow (1 step, parallel)
```
User → Archive Modal → Enter URL → Toggle "Share to Web" → Archive & Share
  ├─ Save to Vault (primary operation)
  └─ Publish to Web (parallel background operation)
```

## Requirements

### Functional Requirements

#### FR-1: Archive Modal UI Updates
- Add "Share to Web" section after general options
- Show toggle switch for enabling web publishing
- Display only when:
  - Valid URL is detected
  - `settings.enableSharing` is true
  - User has credits available

#### FR-2: Archive & Share Flow
- When "Share to Web" is enabled:
  1. Perform normal archiving to Vault
  2. Immediately trigger web publishing in background
  3. Update frontmatter with share information
  4. Show success/failure notifications

#### FR-3: Media Handling by Platform
Different platforms have different media characteristics that affect sharing:

**Instagram:**
- Images: High-quality, multiple images in carousel
- Videos: Short-form vertical videos
- Consideration: Preserve image quality, maintain carousel order
- R2 Upload: Upload all images from carousel

**TikTok:**
- Videos: Vertical short-form videos (dominant)
- Images: Slideshow format
- Consideration: Video optimization for web playback
- R2 Upload: Upload video thumbnail and video file

**Facebook:**
- Images: Single or multiple images
- Videos: Various formats and lengths
- Links: Rich link previews
- Consideration: Mixed content types, link preview handling
- R2 Upload: Upload images and generate video thumbnails

**LinkedIn:**
- Images: Professional photos, infographics
- Videos: Professional content
- Documents: PDFs, presentations
- Consideration: Professional context, document handling
- R2 Upload: Upload images and document previews

**X (Twitter):**
- Images: 1-4 images
- Videos: Short videos
- GIFs: Animated content
- Consideration: Media grid layout (1, 2, 3, 4 images)
- R2 Upload: Upload all images, video thumbnails

**Threads:**
- Images: Similar to Instagram
- Videos: Short-form content
- Consideration: Similar to Instagram handling
- R2 Upload: Upload images

**YouTube:**
- Videos: Primary content (no R2 upload needed - use YouTube embed)
- Thumbnails: Show YouTube thumbnail
- Consideration: Video embedding, transcript handling
- R2 Upload: None (use YouTube player)

#### FR-4: Frontmatter Integration
Archive with share enabled should include:
```yaml
---
share: true
shareUrl: https://social-archive.junlim.org/username/post-id
archived: 2024-01-15T10:30:00Z
lastModified: 2024-01-15T10:30:00Z
platform: facebook
credits_used: 1
---
```

#### FR-5: Error Handling
- Archive failure: Stop entire operation, show error
- Share failure: Archive succeeds, show warning notification
- Partial media failure: Archive succeeds, log media errors
- Network error during share: Queue for retry (future enhancement)

#### FR-6: Credit Management
- Check credits before showing share option
- Consume 1 credit for archive + share operation
- Show remaining credits in modal
- Disable share toggle if no credits available

### Non-Functional Requirements

#### NFR-1: Performance
- Archive operation must not be delayed by sharing
- Sharing happens in background (non-blocking)
- User can close modal immediately after clicking Archive
- Share completion notification appears later

#### NFR-2: User Experience
- Clear visual feedback for each operation stage
- Progressive notifications:
  - "✅ Archived successfully!"
  - "🌐 Publishing to web..." (background)
  - "✅ Shared: [URL]" or "⚠️ Sharing failed"
- Maintain existing Archive Modal simplicity

#### NFR-3: Platform-Specific Media Optimization
- Instagram: Preserve original quality, maintain carousel order
- TikTok: Optimize vertical video for web
- Facebook: Handle mixed media types efficiently
- LinkedIn: Professional image quality
- X: Maintain grid layout integrity
- YouTube: Use embed, no R2 upload
- Threads: Same as Instagram

#### NFR-4: Reliability
- Archive must succeed even if share fails
- Frontmatter updated only after successful share
- Retry mechanism for transient failures
- Graceful degradation if R2 unavailable

## Technical Specifications

### Architecture Changes

#### Archive Modal (`src/modals/ArchiveModal.ts`)
```typescript
interface ArchiveModalState {
  url: string;
  platform: Platform;
  downloadMedia: MediaDownloadMode;
  shareToWeb: boolean;  // NEW
  comment: string;
}
```

#### Archive Service Integration
```typescript
interface ArchiveOptions {
  downloadMedia: MediaDownloadMode;
  comment?: string;
  shareToWeb?: boolean;  // NEW
}

async function archive(url: string, options: ArchiveOptions): Promise<TFile> {
  // 1. Archive to vault
  const file = await archiveToVault(url, options);

  // 2. If shareToWeb enabled, trigger background share
  if (options.shareToWeb) {
    this.shareInBackground(file);
  }

  return file;
}
```

#### Background Share Service
```typescript
async function shareInBackground(file: TFile): Promise<void> {
  try {
    // 1. Read post data from file
    const postData = await this.parsePostFile(file);

    // 2. Upload media to R2 based on platform
    const mediaUrls = await this.uploadMediaByPlatform(postData);

    // 3. Create share record in KV
    const shareId = await this.createShareRecord(postData, mediaUrls);

    // 4. Update frontmatter
    await this.updateFrontmatter(file, {
      share: true,
      shareUrl: `${BASE_URL}/${username}/${shareId}`
    });

    Notice.show(`✅ Shared: ${shareUrl}`);
  } catch (error) {
    Notice.show('⚠️ Sharing failed, but post is saved locally');
    console.error('Share error:', error);
  }
}
```

#### Platform-Specific Media Upload
```typescript
async function uploadMediaByPlatform(
  postData: PostData
): Promise<MediaUrl[]> {
  const { platform, media } = postData;

  switch (platform) {
    case 'instagram':
      // Upload all carousel images, maintain order
      return await uploadInstagramMedia(media);

    case 'tiktok':
      // Upload video + thumbnail
      return await uploadTikTokMedia(media);

    case 'facebook':
      // Upload images, generate video thumbnails
      return await uploadFacebookMedia(media);

    case 'linkedin':
      // Upload professional images, document previews
      return await uploadLinkedInMedia(media);

    case 'x':
      // Upload images in grid, video thumbnails
      return await uploadXMedia(media);

    case 'threads':
      // Similar to Instagram
      return await uploadThreadsMedia(media);

    case 'youtube':
      // No R2 upload, return YouTube embed info
      return await getYouTubeEmbedInfo(media);

    default:
      return await uploadGenericMedia(media);
  }
}
```

### UI Components

#### Share Toggle Section
```svelte
{#if isValidUrl && settings.enableSharing && credits > 0}
<div class="archive-share-section">
  <Setting>
    <div slot="name">Share to Web</div>
    <div slot="description">
      Publish to web after archiving ({credits} credits remaining)
    </div>
    <Toggle
      value={shareToWeb}
      onChange={(value) => shareToWeb = value}
    />
  </Setting>
</div>
{/if}

{#if credits === 0}
<div class="archive-no-credits">
  ⚠️ No credits available. <a href="upgrade">Upgrade to Pro</a>
</div>
{/if}
```

### API Changes

#### Worker API: Enhanced Share Endpoint
```typescript
POST /api/share
{
  "postData": { /* PostData */ },
  "mediaFiles": [
    {
      "filename": "image1.jpg",
      "data": "base64...",
      "contentType": "image/jpeg",
      "platform": "instagram",
      "index": 0  // For carousel order
    }
  ],
  "platform": "instagram"
}

Response:
{
  "success": true,
  "shareId": "abc123",
  "shareUrl": "https://social-archive.junlim.org/junlim/abc123",
  "mediaUrls": [
    "https://social-archiver-api.junlim.org/media/abc123/image1.jpg"
  ]
}
```

## Testing Strategy

### Unit Tests
- [ ] ArchiveModal share toggle state management
- [ ] Archive service with shareToWeb option
- [ ] Background share service error handling
- [ ] Platform-specific media upload logic
- [ ] Frontmatter update after successful share

### Integration Tests
- [ ] Archive + Share flow end-to-end
- [ ] Share failure doesn't affect archive
- [ ] Media upload for each platform
- [ ] Credit consumption
- [ ] Notification sequencing

### Platform-Specific Tests
- [ ] Instagram: Carousel order preservation
- [ ] TikTok: Video optimization
- [ ] Facebook: Mixed media handling
- [ ] LinkedIn: Professional image quality
- [ ] X: Grid layout integrity
- [ ] YouTube: Embed functionality
- [ ] Threads: Image quality

### Manual Testing Scenarios
1. Archive with share enabled (success)
2. Archive with share enabled (share fails)
3. Archive with share disabled
4. Archive with no credits (share disabled)
5. Archive with sharing globally disabled
6. Each platform's media handling

## Success Metrics
- Reduction in steps to share: 2 steps → 1 step
- Share adoption rate increase
- Average time from archive to share decrease
- Error rate for share operations < 5%
- Media upload success rate > 95% per platform

## Future Enhancements
- Retry queue for failed shares
- Batch sharing (multiple posts at once)
- Share templates (pre-configured share settings)
- Share analytics (views, engagement)
- Platform-specific optimization settings

## Dependencies
- Existing Archive Service
- Share API Client
- R2 Bucket for media storage
- KV Store for share records
- Credit management system

## Timeline
- Phase 1: Archive Modal UI + basic share integration (1 week)
- Phase 2: Platform-specific media handling (1 week)
- Phase 3: Error handling + retry logic (3 days)
- Phase 4: Testing + polish (3 days)

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Share failure blocks UI | High | Background processing, non-blocking |
| Media upload fails | Medium | Graceful degradation, retry logic |
| Credit confusion | Low | Clear UI messaging |
| Platform-specific bugs | Medium | Comprehensive per-platform testing |