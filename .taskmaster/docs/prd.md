# Product Requirements Document: Social Archiver for Obsidian

## Project Overview

Social Archiver is an Obsidian plugin that enables users to archive social media posts from multiple platforms directly into their Obsidian vault as markdown notes. The plugin empowers users to maintain complete ownership of their digital social content.

**Mission**: Enable one-click archiving of social media posts (Facebook, LinkedIn, Instagram, TikTok, X.com, Threads) into Obsidian notes, giving users complete data ownership.

**Core Value**: "Save what matters" - User data sovereignty through local-first storage.

## Target Users

### Primary Users
- Active Obsidian users (1M+ potential users)
- Knowledge management practitioners

### Secondary Users  
- Digital archivists and researchers
- Social media marketers
- Journalists and content creators
- Personal knowledge management (PKM) enthusiasts

## Core Requirements

### Functional Requirements

#### 1. Multi-Platform Support
- Support archiving from 6 major platforms:
  - Facebook (posts, videos, shares)
  - LinkedIn (posts, articles, feed updates)
  - Instagram (posts, reels, IGTV)
  - TikTok (videos)
  - X.com/Twitter (tweets, threads, spaces)
  - Threads (posts)
- Validate and parse platform-specific URL patterns
- Handle platform-specific content structures

#### 2. One-Click Archiving
- Simple URL input interface
- Automatic platform detection
- Progress indication during archiving
- Error handling with user-friendly messages

#### 3. Content Extraction
- Extract text content with formatting preservation
- Download and store images locally
- Capture video thumbnails and metadata
- Preserve author information
- Capture engagement metrics (likes, comments, shares)
- Extract hashtags and mentions

#### 4. Markdown Generation
- Create structured markdown notes
- Generate AI-enhanced YAML frontmatter
- Include platform-specific metadata
- Embed images using Obsidian syntax
- Create bidirectional links for mentions

#### 5. AI Enhancement (Optional)
- Generate optimized titles
- Extract key points
- Perform sentiment analysis
- Suggest relevant tags
- Create content summaries
- Fact-checking capabilities (Pro feature)

#### 6. Note Sharing System
- Generate shareable links for archived content
- Time-limited sharing for free users (30 days)
- Permanent sharing for Pro users
- Password protection option
- View tracking analytics

#### 7. Mobile-First Design
- Touch-optimized interface (44px minimum touch targets)
- Mobile share extension support
- Offline-first architecture
- Progressive Web App capabilities

### Non-Functional Requirements

#### Performance
- Archive completion within 30 seconds
- Support virtual scrolling for large archives
- Lazy loading for images and videos
- Batch processing for multiple URLs

#### Security
- HTTPS-only communication
- Local data storage by default
- Input validation and sanitization
- Rate limiting protection
- Legal disclaimer display

#### Usability
- 30-second installation process
- Zero-configuration start
- Intuitive command palette integration
- Keyboard shortcuts support

## Technical Architecture

### Frontend Stack
- **Framework**: Svelte 5 with Runes API
- **Language**: TypeScript 5.0+
- **Styling**: Tailwind CSS v3 (no preflight) + Obsidian CSS variables
- **Bundler**: Vite with @codewithcheese/vite-plugin-obsidian
- **Architecture**: Single Responsibility Principle (SRP) for all services

### Backend Services
- **Serverless**: Cloudflare Workers
- **Storage**: Cloudflare KV Store
- **Content Scraping**: BrightData API
- **AI Processing**: Perplexity API
- **Payment**: Gumroad API

### Obsidian Integration
- Obsidian Plugin API
- Vault API for file operations
- MetadataCache for note management
- Command palette integration

### File Structure
- **Media Storage**: attachments/social-archives/{platform}/
- **Note Storage**: Social Archives/{platform}/{year}/{month}/
- **Note Naming**: {date} - {author} - {title}.md
- **Media Naming**: YYYY-MM-DD_platform_postId

## Feature Specifications

### Phase 1: MVP Features

#### Basic Archiving System
- Implement core plugin structure
- Create URL input modal
- Integrate BrightData API
- Implement basic markdown conversion with SRP pattern
- Setup Cloudflare Worker endpoints
- Setup default media path as 'attachments/social-archives'
- Implement disclaimer component with legal warning text

#### Platform Support
- Facebook post archiving
- LinkedIn post archiving
- Basic error handling
- Progress indicators

### Phase 2: Alpha Features

#### License System
- Implement credit-based system
- Gumroad payment integration
- License key validation
- Usage tracking
- Free trial with 10 credits

#### Enhanced Processing
- Image download and storage
- Metadata extraction
- Engagement metrics capture
- Author information preservation

### Phase 3: Beta Features

#### User Interface
- Settings page with configuration options
- Timeline view for archived posts
- Platform-specific post cards
- Filter and search capabilities

#### AI Integration
- Content summarization
- Tag suggestions
- Sentiment analysis
- Title optimization

#### Extended Platform Support
- Instagram support
- TikTok support
- X.com/Twitter support
- Threads support

### Phase 4: Launch Features

#### Sharing System
- Generate shareable links
- Time-based expiration (Free: 30 days, Pro: permanent)
- Password protection
- View analytics

#### Advanced Features
- Batch archiving
- Scheduled archiving
- Export capabilities
- Import from other tools

### Phase 5: Growth Features

#### Deep Research (Pro)
- Fact-checking integration
- Related source discovery
- Credibility scoring
- Historical context

#### Enterprise Features
- Team collaboration
- Bulk archiving API
- Custom branding
- Advanced analytics

## Pricing Model

### Free Plan
- 10 credits per month
- 30-day share links
- Basic archiving features

### Pro ($19.99/month)
- 500 credits per month
- Permanent share links
- AI analysis features
- Custom domain support
- Deep research capabilities

### Credit Usage
- Basic archive: 1 credit
- Archive with AI: 3 credits
- Deep research: 5 credits

## Development Phases

### Week 1: Foundation
1. Setup Obsidian plugin boilerplate
2. Implement Svelte 5 UI framework
3. Create Cloudflare Worker infrastructure
4. Integrate BrightData API
5. Implement basic markdown conversion

### Week 2: Core Features
1. Build license validation system
2. Integrate Gumroad payments
3. Implement usage tracking
4. Add comprehensive error handling
5. Begin internal testing

### Week 3-4: Platform Expansion
1. Add UI polish and improvements
2. Implement image downloading
3. Build settings configuration
4. Add all 6 platform support
5. Conduct beta testing with 20 users

### Week 5-6: Launch Preparation
1. Submit to Obsidian Community Plugins
2. Prepare marketing materials
3. Create documentation and tutorials
4. Launch on Product Hunt
5. Begin community outreach

### Month 2-3: Growth Phase
1. Collect and implement user feedback
2. Optimize performance
3. Add requested features
4. Build partnerships
5. Scale infrastructure

## Success Metrics

### Launch Metrics (Week 6)
- 100+ plugin downloads
- 20+ beta testers engaged
- 5+ positive reviews

### Month 2 Metrics
- 500+ active users
- $500+ Monthly Recurring Revenue
- 50+ paying customers

### Month 3 Metrics
- 2,000+ active users
- $2,000+ MRR
- 200+ paying customers

### Month 6 Metrics
- 10,000+ active users
- $10,000+ MRR
- 1,000+ paying customers

## Key Principles

### Mobile-First
- Design for mobile usage first (44px minimum touch targets)
- Support share extensions
- Offline-first architecture
- Always display disclaimer: "Archive only content you have permission to save"
- Touch-optimized interfaces

### Security & Privacy
- Local data storage
- No tracking without consent
- Encrypted communications (HTTPS-only)
- Transparent data handling
- Never hardcode API keys
- Input validation on all endpoints
- Rate limiting protection

### User Experience
- 30-second setup time
- One-click operations
- Clear error messages
- Progressive disclosure

### Code Quality
- Single Responsibility Principle (SRP)
- TypeScript strict mode (no any types)
- Comprehensive error handling (try-catch on all async)
- Automated testing
- Svelte 5 Runes usage ($state, not plain variables)
- Services separated by concern (ArchiveService, MarkdownConverter, MediaHandler, VaultManager)

## Constraints & Limitations

### Technical Constraints
- Cannot archive private/restricted posts
- Cannot archive ephemeral content (Stories)
- Cannot archive live streams
- 1MB limit for free users (KV Store)

### Legal Constraints
- Must display usage disclaimers
- Respect platform Terms of Service
- User responsible for content rights
- No automated mass archiving

### Resource Constraints
- API rate limits apply
- Credit-based usage model
- Processing time limitations
- Storage limitations for free tier

## Risk Mitigation

### Technical Risks
- **API Changes**: Abstract platform interfaces, version API clients
- **Rate Limiting**: Implement retry logic, queue system
- **Data Loss**: Local-first storage, backup mechanisms

### Business Risks
- **Platform Policy Changes**: Diversify platform support
- **Competition**: Focus on Obsidian integration uniqueness
- **Pricing Sensitivity**: Offer multiple tiers, free tier

### Legal Risks
- **Copyright Issues**: Clear disclaimers, user responsibility
- **Platform ToS**: Comply with all platform policies
- **Data Privacy**: Local storage, no unnecessary data collection

## Implementation Guidelines

### Architecture Patterns
- Apply Single Responsibility Principle (SRP)
- Use composable Svelte 5 hooks (useArchiveState pattern)
- Implement proper error boundaries
- Follow mobile-first responsive design
- Create unified PostData interface for all platforms
- Use YAML frontmatter for metadata and share controls

### Testing Strategy
- Unit tests for all services
- Integration tests for API endpoints
- E2E tests for critical user flows
- Manual testing on mobile devices

### Documentation Requirements
- User guide with screenshots
- API documentation
- Troubleshooting guide
- Video tutorials

### Code Standards
- TypeScript strict mode
- ESLint + Prettier configuration
- Conventional commits (feat, fix, refactor, docs, test, chore)
- Code review requirements
- Error messages with [Social Archiver] prefix
- User-friendly Notice.show() for errors

## Deliverables

### Phase 1 Deliverables
- Working Obsidian plugin
- Basic archiving for 2 platforms
- Cloudflare Worker API
- Basic documentation

### Phase 2 Deliverables
- License system
- Payment integration
- Usage tracking
- Enhanced error handling

### Phase 3 Deliverables
- Full UI implementation
- All 6 platforms supported
- AI features integrated
- Beta testing completed

### Phase 4 Deliverables
- Community plugin submission
- Marketing materials
- Launch campaign
- User documentation

### Phase 5 Deliverables
- User feedback implementation
- Performance optimizations
- Partnership agreements
- Scaling plan

## Acceptance Criteria

### Functional Acceptance
- Successfully archive from all 6 platforms
- Generate valid markdown notes
- Download and store media files
- Handle errors gracefully

### Performance Acceptance
- Archive within 30 seconds
- Support 1000+ notes without lag
- Mobile responsive design
- Offline functionality

### Quality Acceptance
- No critical bugs
- 95% code coverage
- Positive user feedback
- Documentation complete

### Business Acceptance
- Achieve target download numbers
- Meet revenue projections
- Positive community reception
- Sustainable growth metrics

## Long-Term Vision

### Phase 1 - Social Archiver (Current)
- Focus on archiving capabilities
- "Save what matters" philosophy
- User data ownership through local-first storage
- Obsidian plugin ecosystem integration

### Phase 2 - Very Very Social (Future)
- Independent SNS platform (separate project)
- "Share what you think" philosophy
- Synergy with archiver but independent development
- Modern social networking with user control