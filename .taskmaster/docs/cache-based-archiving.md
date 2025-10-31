# PRD: Cache-Based Archiving System

## Overview
Implement a caching system that reuses recently archived post data across multiple users, significantly reducing BrightData API costs while improving response times. When a user archives a post that was recently archived by another user, the system serves cached data instead of making a new API call.

## Business Value
- **Cost Reduction**: 24-40% reduction in BrightData API costs for viral content
- **Improved UX**: Instant archiving for cached posts (0 credits)
- **Scalability**: Better cost structure as user base grows
- **Competitive Advantage**: Unique feature in archiving space

## User Stories

### As a Free User
- I want to archive viral posts without using my limited credits when someone else recently archived it
- I want to see when I'm using cached data vs fresh data
- I want the option to force-refresh if the cached version is outdated

### As a Pro User
- I want faster archiving for popular content
- I want transparency about cache status
- I want control over when to use cached vs fresh data

## Technical Requirements

### 1. Cache Architecture

#### Storage
- Use Cloudflare KV for cache storage
- Key format: `archive:cache:{platform}:{normalized_url_hash}`
- TTL varies by platform based on content freshness requirements

#### Cache Data Structure
```typescript
interface CachedArchiveData {
  postData: PostData;
  cachedAt: Date;
  expiresAt: Date;
  hitCount: number;
  isPublic: boolean;
  sourceUrl: string;
  platformSpecificTTL: number;
}
```

#### Platform-Specific TTL
- Facebook: 24 hours (relatively static)
- Instagram: 12 hours (Stories expire faster)
- X/Twitter: 6 hours (high real-time importance)
- LinkedIn: 48 hours (professional content less volatile)
- TikTok: 24 hours (trending content changes daily)
- Threads: 12 hours (similar to Instagram)

### 2. Cache Service Implementation

#### CacheManager Service
- Check cache availability before BrightData calls
- Store successful archives in cache (public posts only)
- Implement hit count tracking
- Handle cache invalidation
- URL normalization and hashing

#### Integration Points
- Extend ArchiveService to check cache first
- Modify BrightDataService to skip API calls on cache hit
- Update credit consumption logic (0 credits for cache hits)

### 3. User Interface Changes

#### Archive Modal Enhancements
- Display cache status before archiving
- Show cache age ("cached 2 hours ago")
- Add "Force Fresh" option (costs 1 credit)
- Clear visual distinction between cached and fresh archives

#### Status Indicators
- 📦 Cached (0 credits) - green badge
- 🔍 Fresh (1 credit) - blue badge
- 🔄 Force Refresh (1 credit) - orange badge

### 4. Privacy & Legal Considerations

#### Cache Eligibility Rules
- Only cache public posts (private content never cached)
- Respect platform deletion (implement soft delete flags)
- Allow original authors to request cache removal
- Clear cache on copyright claims

#### User Consent
- Update terms of service to mention caching
- Add disclaimer about cached content
- Allow users to opt-out of using cached data

### 5. Performance & Monitoring

#### Metrics to Track
- Cache hit rate by platform
- Cost savings per month
- Average cache age on hit
- Storage usage in KV
- Popular posts (high hit count)

#### Analytics Dashboard
- Show cost savings to admins
- Display cache effectiveness
- Monitor storage growth
- Track cache invalidation frequency

## Implementation Phases

### Phase 1: Basic Caching (MVP)
- Implement CacheManager service
- Add cache check to ArchiveService
- Simple 24-hour TTL for all platforms
- Basic UI indicators

### Phase 2: Platform Optimization
- Implement platform-specific TTLs
- Add URL normalization
- Implement hit count tracking
- Enhanced UI with cache age display

### Phase 3: Advanced Features
- Force refresh option
- Cache invalidation on source deletion
- Analytics dashboard
- Opt-out preferences

### Phase 4: Intelligence & Optimization
- Predictive cache warming for trending content
- Machine learning for optimal TTL
- Advanced analytics
- Cost optimization algorithms

## Success Metrics

### Primary KPIs
- Cache hit rate: Target 25-30% for viral content
- Cost reduction: Target $24-40 savings per $100 spent
- User satisfaction: Maintain >4.5 stars
- Average archive speed: <2 seconds for cache hits

### Secondary KPIs
- Storage efficiency: <1GB KV usage for 10k users
- Cache freshness: <5% stale content complaints
- Privacy compliance: 0 violations
- System reliability: 99.9% uptime

## Edge Cases & Error Handling

### Cache Miss Scenarios
- First-time archive of any post
- Cache expired (past TTL)
- Private/deleted posts
- User opted out of cache

### Cache Hit Scenarios
- Recent viral post (within TTL)
- Public post archived by multiple users
- Popular creator content

### Error Handling
- KV unavailable: Fall back to direct API
- Corrupted cache data: Invalidate and refresh
- Partial cache data: Treat as miss
- Rate limit on KV: Queue for later

## Security Considerations

### Data Protection
- Encrypt cached data at rest
- Sanitize URLs before hashing
- No caching of authentication tokens
- Regular security audits

### Access Control
- Admin-only cache invalidation
- User-specific cache opt-out
- Rate limiting on cache checks
- Prevent cache poisoning attacks

## Testing Strategy

### Unit Tests
- CacheManager methods
- URL normalization
- TTL calculations
- Hit count tracking

### Integration Tests
- End-to-end archive flow with cache
- KV storage operations
- Credit consumption verification
- Platform-specific behaviors

### Performance Tests
- Cache lookup speed (<50ms)
- Storage growth over time
- Hit rate with simulated traffic
- Cost savings calculations

### User Acceptance Tests
- Cache status visibility
- Force refresh functionality
- Mobile responsiveness
- Error message clarity

## Rollout Plan

### Beta Phase (Week 1-2)
- Enable for Pro users only
- Monitor cache hit rates
- Gather user feedback
- Fix critical bugs

### Limited Release (Week 3-4)
- Enable for 50% of Free users
- A/B test different TTLs
- Optimize cache strategy
- Monitor cost savings

### General Availability (Week 5+)
- Enable for all users
- Announce feature in changelog
- Publish blog post about cost savings
- Monitor long-term performance

## Future Enhancements

### Potential Features
- Cross-platform cache (if same content appears on multiple platforms)
- Collaborative caching (users can share cache benefits)
- Premium cache tier (instant access to trending content)
- Cache export/import for backups
- Cache analytics for content creators

### Research Areas
- Blockchain-based cache verification
- Peer-to-peer cache sharing
- AI-powered cache prediction
- Advanced content fingerprinting

## Dependencies

### External Services
- Cloudflare KV (for cache storage)
- BrightData API (existing scraping service)
- License verification system (for Pro features)

### Internal Components
- ArchiveService
- BrightDataService
- ShareManager
- SettingsTab

## Risks & Mitigations

### Risk: Stale Content
**Mitigation**: Platform-specific TTLs, force refresh option, user feedback mechanism

### Risk: Storage Costs
**Mitigation**: Aggressive TTL, LRU eviction, compression, monitoring

### Risk: Privacy Violations
**Mitigation**: Public-only caching, deletion API, clear ToS, audit logs

### Risk: Cache Poisoning
**Mitigation**: Validation on write, integrity checks, admin monitoring

### Risk: User Confusion
**Mitigation**: Clear UI indicators, help documentation, onboarding tooltips

## Documentation Requirements

### User Documentation
- How cached archiving works
- Benefits of using cache
- When to force refresh
- Privacy implications

### Developer Documentation
- CacheManager API reference
- Cache key format specification
- Integration guide
- Testing procedures

### Admin Documentation
- Cache monitoring dashboard
- Invalidation procedures
- Cost analysis tools
- Troubleshooting guide

## Conclusion

Cache-based archiving represents a significant cost optimization while enhancing user experience. By intelligently reusing recent archive data, we can scale the platform more efficiently and provide faster service to users, especially for viral content that multiple users want to save.
