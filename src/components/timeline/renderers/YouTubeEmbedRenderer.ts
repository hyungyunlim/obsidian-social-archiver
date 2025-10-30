/**
 * YouTubeEmbedRenderer - Renders YouTube and TikTok embeds
 * Single Responsibility: Video embed rendering
 */
export class YouTubeEmbedRenderer {
  /**
   * Render YouTube embed iframe with playback control
   * @returns iframe element for YouTubePlayerController
   */
  renderYouTube(container: HTMLElement, videoId: string): HTMLIFrameElement {
    const embedContainer = container.createDiv();
    embedContainer.style.cssText = 'position: relative; width: 100%; padding-bottom: 56.25%; margin: 12px 0; border-radius: 8px; overflow: hidden; background: var(--background-secondary);';

    // IMPORTANT: enablejsapi=1 is required for postMessage control
    const iframe = embedContainer.createEl('iframe', {
      attr: {
        src: `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1`,
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true',
        referrerpolicy: 'strict-origin-when-cross-origin'
      }
    });
    iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

    return iframe;
  }

  /**
   * Render TikTok embed iframe (direct method)
   */
  renderTikTok(container: HTMLElement, url: string): void {
    console.log('[Timeline] Rendering TikTok embed for URL:', url);

    // Extract video ID from URL
    // URL patterns:
    // - https://www.tiktok.com/@username/video/1234567890
    // - https://vm.tiktok.com/ZMabcdefg/
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      console.warn('[Timeline] Could not extract TikTok video ID from URL:', url);
      // Fallback: show link
      const linkContainer = container.createDiv();
      linkContainer.style.cssText = 'padding: 20px; text-align: center; background: var(--background-secondary); border-radius: 8px; margin: 12px 0;';
      const link = linkContainer.createEl('a', {
        text: 'View on TikTok',
        attr: {
          href: url,
          target: '_blank'
        }
      });
      link.style.cssText = 'color: var(--interactive-accent); text-decoration: underline;';
      return;
    }

    console.log('[Timeline] TikTok video ID:', videoId);

    const embedContainer = container.createDiv();
    embedContainer.style.cssText = 'width: 100%; max-width: 340px; height: 700px; margin: 12px auto; border-radius: 8px; overflow: hidden; background: var(--background-secondary);';

    const iframe = embedContainer.createEl('iframe', {
      attr: {
        src: `https://www.tiktok.com/embed/v2/${videoId}`,
        width: '340',
        height: '700',
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true'
      }
    });
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

    console.log('[Timeline] TikTok iframe created successfully');
  }
}
