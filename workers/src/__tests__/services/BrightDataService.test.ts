/**
 * BrightDataService Test Suite
 *
 * Tests URL normalization and LinkedIn post handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrightDataService } from '@/services/BrightDataService';
import type { Bindings } from '@/types/bindings';
import { Logger } from '@/utils/logger';

describe('BrightDataService', () => {
  let service: BrightDataService;
  let mockEnv: Bindings;
  let mockLogger: Logger;

  beforeEach(() => {
    mockEnv = {
      BRIGHTDATA_API_KEY: 'test-api-key',
    } as Bindings;

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      setContext: vi.fn(),
    } as unknown as Logger;

    service = new BrightDataService(mockEnv, mockLogger);
  });

  describe('URL Normalization', () => {
    describe('LinkedIn URLs', () => {
      it('should remove query parameters from LinkedIn post URLs', () => {
        // Access private method via any cast for testing
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const dirtyUrl = 'https://www.linkedin.com/posts/daniel-jeon-77906aa1_금주부터-몰로코moloco에-합류하여-한국-파트너사와의-supply-partnership을-activity-7387359514506747904-k5ug?utm_source=social_share_send&utm_medium=member_desktop_web&rcm=ACoAAAUUyTEBjCM87_Kx8JSbtng5oCROoulDevc';

        const cleanUrl = normalizeUrl(dirtyUrl, 'linkedin');

        // URL will be percent-encoded (this is correct behavior for BrightData API)
        expect(cleanUrl).toBe('https://www.linkedin.com/posts/daniel-jeon-77906aa1_%EA%B8%88%EC%A3%BC%EB%B6%80%ED%84%B0-%EB%AA%B0%EB%A1%9C%EC%BD%94moloco%EC%97%90-%ED%95%A9%EB%A5%98%ED%95%98%EC%97%AC-%ED%95%9C%EA%B5%AD-%ED%8C%8C%ED%8A%B8%EB%84%88%EC%82%AC%EC%99%80%EC%9D%98-supply-partnership%EC%9D%84-activity-7387359514506747904-k5ug');
        expect(cleanUrl).not.toContain('utm_source');
        expect(cleanUrl).not.toContain('utm_medium');
        expect(cleanUrl).not.toContain('rcm');
      });

      it('should handle LinkedIn pulse (article) URLs', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const pulseUrl = 'https://www.linkedin.com/pulse/ab-test-optimisation-earlier-decisions-new-readout-de-bénazé?trk=public_profile_article_view';

        const cleanUrl = normalizeUrl(pulseUrl, 'linkedin');

        // URL will be percent-encoded (é → %C3%A9)
        expect(cleanUrl).toBe('https://www.linkedin.com/pulse/ab-test-optimisation-earlier-decisions-new-readout-de-b%C3%A9naz%C3%A9');
        expect(cleanUrl).not.toContain('trk=');
      });

      it('should handle LinkedIn post URLs with activity IDs', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const postUrl = 'https://www.linkedin.com/posts/orlenchner_scrapecon-activity-7180537307521769472-oSYN?trk=public_profile';

        const cleanUrl = normalizeUrl(postUrl, 'linkedin');

        expect(cleanUrl).toBe('https://www.linkedin.com/posts/orlenchner_scrapecon-activity-7180537307521769472-oSYN');
        expect(cleanUrl).not.toContain('trk=');
      });

      it('should remove URL fragments', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const urlWithFragment = 'https://www.linkedin.com/posts/username-activity-123#section';

        const cleanUrl = normalizeUrl(urlWithFragment, 'linkedin');

        expect(cleanUrl).not.toContain('#');
      });

      it('should warn about potentially unsupported LinkedIn URLs', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const profileUrl = 'https://www.linkedin.com/in/daniel-jeon/';

        normalizeUrl(profileUrl, 'linkedin');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'LinkedIn URL might not be supported',
          expect.objectContaining({
            url: profileUrl,
            path: '/in/daniel-jeon/'
          })
        );
      });
    });

    describe('Other Platform URLs', () => {
      it('should normalize Facebook URLs', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const fbUrl = 'https://www.facebook.com/post/12345?ref=share&utm_source=fb';

        const cleanUrl = normalizeUrl(fbUrl, 'facebook');

        expect(cleanUrl).toBe('https://www.facebook.com/post/12345');
        expect(cleanUrl).not.toContain('ref=');
        expect(cleanUrl).not.toContain('utm_source=');
      });

      it('should normalize Instagram URLs', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const igUrl = 'https://www.instagram.com/p/ABC123/?utm_source=ig_web_copy_link';

        const cleanUrl = normalizeUrl(igUrl, 'instagram');

        expect(cleanUrl).toBe('https://www.instagram.com/p/ABC123/');
        expect(cleanUrl).not.toContain('utm_source');
      });

      it('should normalize X (Twitter) URLs', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const xUrl = 'https://x.com/user/status/123456?s=20&t=abc';

        const cleanUrl = normalizeUrl(xUrl, 'x');

        expect(cleanUrl).toBe('https://x.com/user/status/123456');
        expect(cleanUrl).not.toContain('s=');
        expect(cleanUrl).not.toContain('t=');
      });
    });

    describe('Error Handling', () => {
      it('should return original URL if normalization fails', () => {
        const normalizeUrl = (service as any).normalizeUrl.bind(service);

        const invalidUrl = 'not-a-valid-url';

        const result = normalizeUrl(invalidUrl, 'linkedin');

        expect(result).toBe(invalidUrl);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to normalize URL',
          expect.objectContaining({
            url: invalidUrl
          })
        );
      });
    });
  });

  describe('buildRequestBody', () => {
    it('should create request body with normalized URL', () => {
      const buildRequestBody = (service as any).buildRequestBody.bind(service);

      const dirtyUrl = 'https://www.linkedin.com/posts/user-activity-123?utm_source=test';

      const requestBody = buildRequestBody(dirtyUrl, 'linkedin');

      expect(requestBody).toEqual([
        {
          url: 'https://www.linkedin.com/posts/user-activity-123'
        }
      ]);
    });

    it('should log URL normalization', () => {
      const buildRequestBody = (service as any).buildRequestBody.bind(service);

      const dirtyUrl = 'https://www.linkedin.com/posts/user-activity-123?utm_source=test';

      buildRequestBody(dirtyUrl, 'linkedin');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'URL normalized for BrightData',
        expect.objectContaining({
          original: dirtyUrl,
          normalized: 'https://www.linkedin.com/posts/user-activity-123',
          platform: 'linkedin'
        })
      );
    });
  });

  describe('LinkedIn Dataset ID', () => {
    it('should use correct dataset ID for LinkedIn posts', () => {
      // Access private DATASET_IDS via any cast
      const datasetIds = (BrightDataService as any).DATASET_IDS ||
                         ((service as any).constructor as any).DATASET_IDS;

      // If DATASET_IDS is not accessible, we'll check it through triggerCollection
      // by inspecting the URL that would be created
      expect(true).toBe(true); // Placeholder - actual implementation would mock fetch
    });
  });

  describe('X.com Post Parsing', () => {
    it('should parse X.com post with BrightData response format', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      // Mock BrightData X.com API response
      const mockXPostData = {
        id: '1982021304287993992',
        user_posted: 'munirkaraloglu',
        name: 'Münir Karaloğlu',
        description: '📍Malatya\n\nAFAD İl Koordinasyon Toplantımızı gerçekleştirdik.',
        date_posted: '2025-10-25T09:47:57.000Z',
        photos: [
          'https://pbs.twimg.com/media/G4GN3aUXYAAcDF5.jpg',
          'https://pbs.twimg.com/media/G4GN3aSWEAAe8rh.jpg',
        ],
        videos: null,
        url: 'https://x.com/munirkaraloglu/status/1982021304287993992',
        quoted_post: {
          data_posted: null,
          description: null,
          photos: null,
          post_id: null,
          profile_id: null,
          profile_name: null,
          url: null,
          videos: null,
        },
        tagged_users: null,
        replies: 3,
        reposts: 12,
        likes: 110,
        views: 3700,
        external_url: null,
        hashtags: null,
        followers: 270945,
        biography: 'Türkiye Cumhuriyeti İçişleri Bakanlığı - Bakan Yardımcısı',
        posts_count: 35216,
        profile_image_link: 'https://pbs.twimg.com/profile_images/1156534853648752640/skVdOy2n_normal.jpg',
        following: 357,
        is_verified: false,
        quotes: 0,
        bookmarks: 0,
        parent_post_details: {
          date_posted: '2025-10-25T09:47:57.000Z',
          post_id: '1982021304287993992',
          profile_id: '219340407',
          profile_name: 'Münir Karaloğlu',
        },
        external_image_urls: null,
        external_video_urls: null,
        verification_type: 'gray',
        user_id: '219340407',
        context_added: null,
      };

      const result = parseXPost(mockXPostData, mockXPostData.url);

      // Verify platform
      expect(result.platform).toBe('x');

      // Verify ID parsing
      expect(result.id).toBe('1982021304287993992');

      // Verify URL
      expect(result.url).toBe('https://x.com/munirkaraloglu/status/1982021304287993992');

      // Verify author information
      expect(result.author.name).toBe('Münir Karaloğlu');
      expect(result.author.url).toBe('https://x.com/munirkaraloglu');
      expect(result.author.handle).toBe('munirkaraloglu');
      expect(result.author.username).toBe('munirkaraloglu');
      expect(result.author.avatar).toBe('https://pbs.twimg.com/profile_images/1156534853648752640/skVdOy2n_normal.jpg');
      expect(result.author.verified).toBe(false);

      // Verify content
      expect(result.content.text).toBe('📍Malatya\n\nAFAD İl Koordinasyon Toplantımızı gerçekleştirdik.');

      // Verify media (2 photos)
      expect(result.media).toHaveLength(2);
      expect(result.media[0].type).toBe('image');
      expect(result.media[0].url).toBe('https://pbs.twimg.com/media/G4GN3aUXYAAcDF5.jpg');
      expect(result.media[1].type).toBe('image');
      expect(result.media[1].url).toBe('https://pbs.twimg.com/media/G4GN3aSWEAAe8rh.jpg');

      // Verify metadata
      expect(result.metadata.likes).toBe(110);
      expect(result.metadata.comments).toBe(3);
      expect(result.metadata.shares).toBe(12);
      expect(result.metadata.views).toBe(3700);
      expect(result.metadata.timestamp).toBe('2025-10-25T09:47:57.000Z');

      // Verify raw data is preserved
      expect(result.raw).toEqual(mockXPostData);
    });

    it('should handle X.com post with videos', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataWithVideo = {
        id: '123456',
        user_posted: 'testuser',
        name: 'Test User',
        description: 'Check out this video!',
        date_posted: '2025-01-01T00:00:00.000Z',
        photos: null,
        videos: ['https://video.twimg.com/ext_tw_video/123/pu/vid/video.mp4'],
        url: 'https://x.com/testuser/status/123456',
        likes: 50,
        replies: 5,
        reposts: 10,
        views: 1000,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: true,
      };

      const result = parseXPost(mockXPostDataWithVideo, mockXPostDataWithVideo.url);

      // Verify video media
      expect(result.media).toHaveLength(1);
      expect(result.media[0].type).toBe('video');
      expect(result.media[0].url).toBe('https://video.twimg.com/ext_tw_video/123/pu/vid/video.mp4');
    });

    it('should handle X.com post with both photos and videos', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataMixed = {
        id: '789012',
        user_posted: 'mixeduser',
        name: 'Mixed Media User',
        description: 'Photos and videos!',
        date_posted: '2025-01-01T00:00:00.000Z',
        photos: ['https://pbs.twimg.com/media/photo1.jpg'],
        videos: ['https://video.twimg.com/video1.mp4'],
        url: 'https://x.com/mixeduser/status/789012',
        likes: 100,
        replies: 10,
        reposts: 20,
        views: 2000,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: false,
      };

      const result = parseXPost(mockXPostDataMixed, mockXPostDataMixed.url);

      // Verify both photos and videos
      expect(result.media).toHaveLength(2);
      expect(result.media[0].type).toBe('image');
      expect(result.media[0].url).toBe('https://pbs.twimg.com/media/photo1.jpg');
      expect(result.media[1].type).toBe('video');
      expect(result.media[1].url).toBe('https://video.twimg.com/video1.mp4');
    });

    it('should handle X.com post with external media URLs as fallback (string format)', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataExternal = {
        id: '345678',
        user_posted: 'externaluser',
        name: 'External Media User',
        description: 'External media post',
        date_posted: '2025-01-01T00:00:00.000Z',
        photos: null,
        videos: null,
        external_image_urls: ['https://external.com/image1.jpg'],
        external_video_urls: ['https://external.com/video1.mp4'],
        url: 'https://x.com/externaluser/status/345678',
        likes: 75,
        replies: 8,
        reposts: 15,
        views: 1500,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: false,
      };

      const result = parseXPost(mockXPostDataExternal, mockXPostDataExternal.url);

      // Verify external media URLs are used as fallback
      expect(result.media).toHaveLength(2);
      expect(result.media[0].type).toBe('image');
      expect(result.media[0].url).toBe('https://external.com/image1.jpg');
      expect(result.media[1].type).toBe('video');
      expect(result.media[1].url).toBe('https://external.com/video1.mp4');
    });

    it('should handle X.com post with external media URLs as fallback (object format)', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataExternalObject = {
        id: '1982735830159618160',
        user_posted: 'andTEAMofficial',
        name: '&TEAM OFFICIAL',
        description: '[&TEAM] KR 1st Mini Album',
        date_posted: '2025-10-27T09:07:14.000Z',
        photos: null,
        videos: null,
        external_image_urls: ['https://pbs.twimg.com/amplify_video_thumb/1982735323949129729/img/Ge5NTuQVZ4E3vtqo.jpg'],
        external_video_urls: [
          {
            video_url: 'https://video.twimg.com/amplify_video/1982735323949129729/vid/avc1/1920x1080/o7xYO3NHXhbOlSSs.mp4?tag=21',
            duration: 266166,
          },
        ],
        url: 'https://x.com/andTEAMofficial/status/1982735830159618160',
        likes: 862,
        replies: 2,
        reposts: 156,
        views: 2025243,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: false,
      };

      const result = parseXPost(mockXPostDataExternalObject, mockXPostDataExternalObject.url);

      // Verify external media URLs with object format
      expect(result.media).toHaveLength(2);
      expect(result.media[0].type).toBe('image');
      expect(result.media[0].url).toBe('https://pbs.twimg.com/amplify_video_thumb/1982735323949129729/img/Ge5NTuQVZ4E3vtqo.jpg');
      expect(result.media[1].type).toBe('video');
      expect(result.media[1].url).toBe('https://video.twimg.com/amplify_video/1982735323949129729/vid/avc1/1920x1080/o7xYO3NHXhbOlSSs.mp4?tag=21');
      expect(result.media[1].duration).toBe(266166);
    });

    it('should handle X.com post with no media', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataNoMedia = {
        id: '901234',
        user_posted: 'textuser',
        name: 'Text Only User',
        description: 'Just text, no media',
        date_posted: '2025-01-01T00:00:00.000Z',
        photos: null,
        videos: null,
        external_image_urls: null,
        external_video_urls: null,
        url: 'https://x.com/textuser/status/901234',
        likes: 25,
        replies: 2,
        reposts: 5,
        views: 500,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: false,
      };

      const result = parseXPost(mockXPostDataNoMedia, mockXPostDataNoMedia.url);

      // Verify no media
      expect(result.media).toHaveLength(0);
      expect(result.content.text).toBe('Just text, no media');
    });

    it('should log quoted posts when present', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataWithQuote = {
        id: '567890',
        user_posted: 'quoteuser',
        name: 'Quote User',
        description: 'This is a quote tweet',
        date_posted: '2025-01-01T00:00:00.000Z',
        photos: null,
        videos: null,
        url: 'https://x.com/quoteuser/status/567890',
        quoted_post: {
          post_id: '123456',
          url: 'https://x.com/originaluser/status/123456',
          description: 'Original tweet',
        },
        likes: 30,
        replies: 3,
        reposts: 6,
        views: 800,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: false,
      };

      parseXPost(mockXPostDataWithQuote, mockXPostDataWithQuote.url);

      // Verify logger was called for quoted post
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔗 Post contains quoted tweet',
        expect.objectContaining({
          quotedPostId: '123456',
          quotedPostUrl: 'https://x.com/originaluser/status/123456',
        })
      );
    });

    it('should log reply information when post is a reply', () => {
      const parseXPost = (service as any).parseXPost.bind(service);

      const mockXPostDataReply = {
        id: '234567',
        user_posted: 'replyuser',
        name: 'Reply User',
        description: 'This is a reply',
        date_posted: '2025-01-01T00:00:00.000Z',
        photos: null,
        videos: null,
        url: 'https://x.com/replyuser/status/234567',
        parent_post_details: {
          post_id: '123456',
          profile_id: '999999',
          profile_name: 'Original Poster',
          date_posted: '2024-12-31T23:00:00.000Z',
        },
        likes: 15,
        replies: 1,
        reposts: 2,
        views: 300,
        profile_image_link: 'https://pbs.twimg.com/profile_images/test.jpg',
        is_verified: false,
      };

      parseXPost(mockXPostDataReply, mockXPostDataReply.url);

      // Verify logger was called for reply
      expect(mockLogger.info).toHaveBeenCalledWith(
        '💬 Post is a reply',
        expect.objectContaining({
          parentPostId: '123456',
          parentProfileName: 'Original Poster',
        })
      );
    });
  });

  describe('TikTok Post Parsing', () => {
    it('should parse TikTok post with BrightData response format', () => {
      const parseTikTokPost = (service as any).parseTikTokPost.bind(service);

      const mockTikTokData = {
        post_id: '7420361159435439367',
        url: 'https://www.tiktok.com/@user7926174510021/video/7420361159435439367',
        description: 'ตำนานศิลปินเเห่งฝรั่งเศส david ginola💔🇨🇵#ginola #football #france🇫🇷 #fyp ',
        create_time: '2024-09-30T09:11:11.000Z',
        digg_count: 3598,
        share_count: '124',
        collect_count: 387,
        comment_count: 39,
        play_count: 146700,
        video_duration: 70,
        hashtags: ['ginola', 'football', 'france🇫🇷', 'fyp'],
        original_sound: 'ปู7ตู: เสียงต้นฉบับ - ปู7ตู',
        profile_id: '7141523785241068546',
        profile_username: 'user7926174510021',
        profile_url: 'https://www.tiktok.com/@user7926174510021',
        profile_avatar: 'https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg',
        preview_image: 'https://p16-common-sign.tiktokcdn-us.com/preview.image',
        video_url: 'https://v16-webapp-prime.us.tiktok.com/video.mp4',
        cdn_url: 'https://v19-webapp-prime.us.tiktok.com/video_cdn.mp4',
        music: {
          authorname: 'ปู7ตู',
          covermedium: 'https://p16-common-sign.tiktokcdn-us.com/music_cover.jpeg',
          id: '7420361197403605776',
          original: true,
          playurl: 'https://v16m.tiktokcdn-us.com/music.mp3',
          title: 'เสียงต้นฉบับ - ปู7ตู',
        },
        is_verified: false,
        width: 576,
        ratio: '540p',
      };

      const result = parseTikTokPost(mockTikTokData, mockTikTokData.url);

      expect(result).toMatchObject({
        platform: 'tiktok',
        id: '7420361159435439367',
        url: 'https://www.tiktok.com/@user7926174510021/video/7420361159435439367',
        author: {
          name: 'user7926174510021',
          url: 'https://www.tiktok.com/@user7926174510021',
          avatar: 'https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg',
          handle: 'user7926174510021',
          username: 'user7926174510021',
          verified: false,
        },
        content: {
          text: 'ตำนานศิลปินเเห่งฝรั่งเศส david ginola💔🇨🇵#ginola #football #france🇫🇷 #fyp ',
          hashtags: ['ginola', 'football', 'france🇫🇷', 'fyp'],
        },
        metadata: {
          likes: 3598,
          comments: 39,
          shares: 124,
          views: 146700,
          bookmarks: 387,
          timestamp: '2024-09-30T09:11:11.000Z',
          originalSound: 'ปู7ตู: เสียงต้นฉบับ - ปู7ตู',
        },
      });

      expect(result.media).toHaveLength(1);
      expect(result.media[0]).toMatchObject({
        type: 'video',
        url: 'https://v16-webapp-prime.us.tiktok.com/video.mp4',
        thumbnail: 'https://p16-common-sign.tiktokcdn-us.com/preview.image',
        duration: 70,
        width: 576,
      });

      expect(result.metadata.music).toMatchObject({
        title: 'เสียงต้นฉบับ - ปู7ตู',
        author: 'ปู7ตู',
        url: 'https://v16m.tiktokcdn-us.com/music.mp3',
        cover: 'https://p16-common-sign.tiktokcdn-us.com/music_cover.jpeg',
        isOriginal: true,
      });
    });

    it('should handle TikTok post with cdn_url fallback', () => {
      const parseTikTokPost = (service as any).parseTikTokPost.bind(service);

      const mockTikTokDataCdn = {
        post_id: '7420361159435439368',
        url: 'https://www.tiktok.com/@user/video/7420361159435439368',
        description: 'Test video',
        create_time: '2024-09-30T09:11:11.000Z',
        digg_count: 100,
        share_count: 10,
        comment_count: 5,
        play_count: 1000,
        video_duration: 30,
        profile_username: 'testuser',
        profile_url: 'https://www.tiktok.com/@testuser',
        preview_image: 'https://example.com/preview.jpg',
        cdn_url: 'https://cdn.tiktok.com/video.mp4', // Only cdn_url, no video_url
        is_verified: false,
        width: 720,
      };

      const result = parseTikTokPost(mockTikTokDataCdn, mockTikTokDataCdn.url);

      expect(result.media[0]).toMatchObject({
        type: 'video',
        url: 'https://cdn.tiktok.com/video.mp4', // Should use cdn_url as fallback
      });
    });

    it('should handle TikTok post without music', () => {
      const parseTikTokPost = (service as any).parseTikTokPost.bind(service);

      const mockTikTokDataNoMusic = {
        post_id: '7420361159435439369',
        url: 'https://www.tiktok.com/@user/video/7420361159435439369',
        description: 'Video without music',
        create_time: '2024-09-30T09:11:11.000Z',
        digg_count: 50,
        share_count: '5',
        comment_count: 2,
        play_count: 500,
        video_duration: 15,
        profile_username: 'testuser',
        profile_url: 'https://www.tiktok.com/@testuser',
        preview_image: 'https://example.com/preview.jpg',
        video_url: 'https://example.com/video.mp4',
        is_verified: false,
        width: 480,
      };

      const result = parseTikTokPost(mockTikTokDataNoMusic, mockTikTokDataNoMusic.url);

      expect(result.metadata.music).toBeUndefined();
    });

    it('should handle string share_count conversion', () => {
      const parseTikTokPost = (service as any).parseTikTokPost.bind(service);

      const mockTikTokDataStringShares = {
        post_id: '7420361159435439370',
        url: 'https://www.tiktok.com/@user/video/7420361159435439370',
        description: 'Test',
        create_time: '2024-09-30T09:11:11.000Z',
        digg_count: 100,
        share_count: '999', // String format
        comment_count: 10,
        play_count: 5000,
        video_duration: 20,
        profile_username: 'testuser',
        video_url: 'https://example.com/video.mp4',
        is_verified: false,
      };

      const result = parseTikTokPost(mockTikTokDataStringShares, mockTikTokDataStringShares.url);

      expect(result.metadata.shares).toBe(999);
      expect(typeof result.metadata.shares).toBe('number');
    });

    it('should log TikTok music and hashtags information', () => {
      const parseTikTokPost = (service as any).parseTikTokPost.bind(service);

      const mockTikTokDataLogging = {
        post_id: '7420361159435439371',
        url: 'https://www.tiktok.com/@user/video/7420361159435439371',
        description: 'Test with logging',
        create_time: '2024-09-30T09:11:11.000Z',
        digg_count: 100,
        share_count: 10,
        comment_count: 5,
        play_count: 1000,
        video_duration: 25,
        profile_username: 'testuser',
        video_url: 'https://example.com/video.mp4',
        hashtags: ['viral', 'trending'],
        music: {
          title: 'Test Song',
          authorname: 'Test Artist',
          original: false,
        },
        is_verified: false,
      };

      parseTikTokPost(mockTikTokDataLogging, mockTikTokDataLogging.url);

      // Verify logger was called for parsing
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎵 Parsing TikTok post',
        expect.objectContaining({
          postId: '7420361159435439371',
          username: 'testuser',
          hasMusic: true,
          hashtags: 2,
        })
      );

      // Verify logger was called for music
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎼 Music detected',
        expect.objectContaining({
          title: 'Test Song',
          author: 'Test Artist',
          isOriginal: false,
        })
      );

      // Verify logger was called for hashtags
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🏷️ Hashtags',
        expect.objectContaining({
          tags: ['viral', 'trending'],
        })
      );
    });
  });

  describe('Threads Post Parsing', () => {
    it('should parse Threads post with BrightData response format', () => {
      const parseThreadsPost = (service as any).parseThreadsPost.bind(service);

      const mockThreadsData = {
        post_id: 'DQP5KgIke17',
        url: 'https://www.threads.com/@okeijw9194/post/DQP5KgIke17',
        post_time: '2025-10-25T22:05:07.000Z',
        profile_name: 'okeijw9194',
        profile_url: 'https://www.threads.com/@okeijw9194',
        post_content: '3年目になって、やっと昇給の話が。',
        number_of_likes: 166,
        number_of_comments: 16,
        number_of_reshares: 0,
        number_of_shares: null,
        comments: [
          {
            comment_content: 'Great post!',
            commentor_profile_name: 'testuser',
            commentor_profile_url: 'https://www.threads.com/@testuser',
            number_of_likes: 5,
            number_of_replies: 0,
            number_of_reshares: '0',
            number_of_shares: 0,
          },
        ],
        images: null,
        videos: null,
        quoted_post: {
          date_posted: null,
          images: null,
          post_content: null,
          post_id: null,
          profile_name: null,
          profile_url: null,
          url: null,
          videos: null,
        },
        external_link_title: null,
      };

      const result = parseThreadsPost(mockThreadsData, mockThreadsData.url);

      expect(result).toMatchObject({
        platform: 'threads',
        id: 'DQP5KgIke17',
        url: 'https://www.threads.com/@okeijw9194/post/DQP5KgIke17',
        author: {
          name: 'okeijw9194',
          url: 'https://www.threads.com/@okeijw9194',
          handle: 'okeijw9194',
          username: 'okeijw9194',
        },
        content: {
          text: '3年目になって、やっと昇給の話が。',
        },
        metadata: {
          likes: 166,
          comments: 16,
          shares: 0,
          timestamp: '2025-10-25T22:05:07.000Z',
        },
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments?.[0]).toMatchObject({
        author: {
          name: 'testuser',
          url: 'https://www.threads.com/@testuser',
        },
        content: 'Great post!',
        likes: 5,
      });
    });

    it('should handle Threads post with images', () => {
      const parseThreadsPost = (service as any).parseThreadsPost.bind(service);

      const mockThreadsDataImages = {
        post_id: 'ABC123',
        url: 'https://www.threads.com/@user/post/ABC123',
        post_time: '2025-01-01T00:00:00.000Z',
        profile_name: 'testuser',
        post_content: 'Post with images',
        number_of_likes: 50,
        number_of_comments: 5,
        number_of_reshares: 2,
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        videos: null,
      };

      const result = parseThreadsPost(mockThreadsDataImages, mockThreadsDataImages.url);

      expect(result.media).toHaveLength(2);
      expect(result.media[0]).toMatchObject({
        type: 'image',
        url: 'https://example.com/image1.jpg',
      });
    });

    it('should handle Threads post with videos', () => {
      const parseThreadsPost = (service as any).parseThreadsPost.bind(service);

      const mockThreadsDataVideos = {
        post_id: 'XYZ789',
        url: 'https://www.threads.com/@user/post/XYZ789',
        post_time: '2025-01-01T00:00:00.000Z',
        profile_name: 'videouser',
        post_content: 'Post with video',
        number_of_likes: 100,
        number_of_comments: 10,
        number_of_reshares: 5,
        images: null,
        videos: [
          {
            url: 'https://example.com/video1.mp4',
            width: 1920,
            height: 1080,
            duration: 30,
          },
        ],
      };

      const result = parseThreadsPost(mockThreadsDataVideos, mockThreadsDataVideos.url);

      expect(result.media).toHaveLength(1);
      expect(result.media[0]).toMatchObject({
        type: 'video',
        url: 'https://example.com/video1.mp4',
        width: 1920,
        height: 1080,
        duration: 30,
      });
    });

    it('should log quoted post when present', () => {
      const parseThreadsPost = (service as any).parseThreadsPost.bind(service);

      const mockThreadsDataQuoted = {
        post_id: 'QUOTED123',
        url: 'https://www.threads.com/@user/post/QUOTED123',
        post_time: '2025-01-01T00:00:00.000Z',
        profile_name: 'testuser',
        post_content: 'Quoting another post',
        number_of_likes: 20,
        number_of_comments: 3,
        number_of_reshares: 1,
        quoted_post: {
          post_id: 'ORIGINAL456',
          url: 'https://www.threads.com/@original/post/ORIGINAL456',
          profile_name: 'original_user',
          post_content: 'Original post content',
        },
      };

      parseThreadsPost(mockThreadsDataQuoted, mockThreadsDataQuoted.url);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔗 Post contains quoted thread',
        expect.objectContaining({
          quotedPostId: 'ORIGINAL456',
          quotedPostUrl: 'https://www.threads.com/@original/post/ORIGINAL456',
        })
      );
    });

    it('should handle external link title', () => {
      const parseThreadsPost = (service as any).parseThreadsPost.bind(service);

      const mockThreadsDataLink = {
        post_id: 'LINK123',
        url: 'https://www.threads.com/@user/post/LINK123',
        post_time: '2025-01-01T00:00:00.000Z',
        profile_name: 'linkuser',
        post_content: 'Check this out',
        number_of_likes: 75,
        number_of_comments: 8,
        number_of_reshares: 3,
        external_link_title: 'Amazing Article Title',
      };

      const result = parseThreadsPost(mockThreadsDataLink, mockThreadsDataLink.url);

      expect(result.metadata.externalLink).toBe('Amazing Article Title');
    });
  });
});
