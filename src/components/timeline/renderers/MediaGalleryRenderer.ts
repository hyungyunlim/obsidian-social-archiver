import { setIcon } from 'obsidian';
import type { Media, PostData } from '../../../types/post';

/**
 * MediaGalleryRenderer - Renders media carousel with thumbnails
 * Single Responsibility: Media gallery UI rendering
 */
export class MediaGalleryRenderer {
  constructor(
    private getResourcePath: (path: string) => string
  ) {}

  /**
   * Render media carousel with Instagram-style thumbnails
   */
  render(container: HTMLElement, media: Media[], post?: PostData): void {
    const carouselContainer = container.createDiv({
      cls: 'relative mt-3 rounded-lg overflow-hidden bg-[var(--background-modifier-border)]'
    });

    // Extract links from post content if available
    let extractedLink: string | null = null;
    if (post && media.length === 1) {
      const content = post.content.text;
      // Extract all URLs (markdown links and plain URLs)
      const markdownLinks = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => m[2]);
      const plainUrls = [...content.matchAll(/(https?:\/\/[^\s]+)/g)].map(m => m[1]);
      const allLinks = [...markdownLinks, ...plainUrls];

      // If exactly one link exists, use it for the image click
      if (allLinks.length === 1 && allLinks[0]) {
        extractedLink = allLinks[0];
      }
    }

    // Media container - preserves aspect ratio with max-height
    const mediaContainer = carouselContainer.createDiv();
    mediaContainer.style.cssText = 'position: relative; width: 100%; max-height: 600px; min-height: 200px; display: flex; align-items: center; justify-content: center;';

    let currentIndex = 0;

    // Create all media elements (hidden except current)
    const mediaElements: HTMLElement[] = [];
    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i];
      if (!mediaItem) continue; // Skip if undefined

      const resourcePath = this.getResourcePath(mediaItem.url);

      // Determine if it's a video or image
      const isVideo = mediaItem.type === 'video' ||
                      mediaItem.url.endsWith('.mp4') ||
                      mediaItem.url.endsWith('.webm') ||
                      mediaItem.url.endsWith('.mov');

      let element: HTMLElement;

      if (isVideo) {
        // Render video - preserves original aspect ratio
        const video = mediaContainer.createEl('video', {
          attr: {
            src: resourcePath,
            controls: true,
            preload: 'metadata'
          }
        });

        video.style.cssText = 'max-width: 100%; max-height: 600px; width: auto; height: auto;';
        video.style.display = i === 0 ? 'block' : 'none';

        // Handle video load error (e.g., attachment not found, sync issue)
        video.addEventListener('error', () => {
          console.warn(`[MediaGalleryRenderer] Failed to load video: ${resourcePath}`);

          // Create placeholder for missing video
          const placeholder = mediaContainer.createDiv();
          placeholder.style.cssText = `
            display: ${i === 0 ? 'flex' : 'none'};
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 200px;
            background: var(--background-secondary);
            border: 1px dashed var(--background-modifier-border);
            border-radius: 8px;
            padding: 24px;
            gap: 12px;
          `;

          // Icon
          const iconDiv = placeholder.createDiv();
          iconDiv.style.cssText = 'width: 48px; height: 48px; opacity: 0.3;';
          setIcon(iconDiv, 'video-off');

          // Message
          const message = placeholder.createDiv({
            text: 'Video not available',
            cls: 'text-sm'
          });
          message.style.cssText = 'color: var(--text-muted); font-size: 0.875rem;';

          const hint = placeholder.createDiv({
            text: 'The attachment may not be synced yet',
            cls: 'text-xs'
          });
          hint.style.cssText = 'color: var(--text-faint); font-size: 0.75rem;';

          // Replace video with placeholder
          video.remove();
          mediaElements[i] = placeholder;
        });

        element = video;
      } else {
        // Render image - preserves original aspect ratio
        const img = mediaContainer.createEl('img', {
          attr: {
            src: resourcePath,
            alt: mediaItem.altText || `Image ${i + 1}`
          }
        });

        img.style.cssText = 'max-width: 100%; max-height: 600px; width: auto; height: auto;';
        img.style.display = i === 0 ? 'block' : 'none';

        // Handle image load error (e.g., attachment not found, sync issue)
        img.addEventListener('error', () => {
          console.warn(`[MediaGalleryRenderer] Failed to load image: ${resourcePath}`);

          // Create placeholder for missing image
          const placeholder = mediaContainer.createDiv();
          placeholder.style.cssText = `
            display: ${i === 0 ? 'flex' : 'none'};
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 200px;
            background: var(--background-secondary);
            border: 1px dashed var(--background-modifier-border);
            border-radius: 8px;
            padding: 24px;
            gap: 12px;
          `;

          // Icon
          const iconDiv = placeholder.createDiv();
          iconDiv.style.cssText = 'width: 48px; height: 48px; opacity: 0.3;';
          setIcon(iconDiv, 'image-off');

          // Message
          const message = placeholder.createDiv({
            text: 'Image not available',
            cls: 'text-sm'
          });
          message.style.cssText = 'color: var(--text-muted); font-size: 0.875rem;';

          const hint = placeholder.createDiv({
            text: 'The attachment may not be synced yet',
            cls: 'text-xs'
          });
          hint.style.cssText = 'color: var(--text-faint); font-size: 0.75rem;';

          // Replace img with placeholder
          img.remove();
          mediaElements[i] = placeholder;
        });

        // If single image and single link, make image clickable
        if (extractedLink && media.length === 1) {
          img.style.cursor = 'pointer';
          img.setAttribute('title', `Open link: ${extractedLink}`);
          img.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(extractedLink, '_blank');
          });
        }

        element = img;
      }

      mediaElements.push(element);
    }

    // Thumbnail navigation (Instagram style)
    if (media.length > 1) {
      // Thumbnails container
      const thumbnailsContainer = carouselContainer.createDiv();
      thumbnailsContainer.style.cssText = 'display: flex; gap: 8px; padding: 12px; overflow-x: auto; background: rgba(0, 0, 0, 0.02); scrollbar-width: thin; scrollbar-color: var(--background-modifier-border) transparent;';

      // Add webkit scrollbar styles
      thumbnailsContainer.addClass('media-thumbnails-scroll');

      // Convert vertical wheel scroll to horizontal scroll
      thumbnailsContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        thumbnailsContainer.scrollLeft += e.deltaY;
      });

      // Create thumbnails
      const thumbnailElements: HTMLElement[] = [];
      for (let i = 0; i < media.length; i++) {
        const mediaItem = media[i];
        if (!mediaItem) continue; // Skip if undefined

        const resourcePath = this.getResourcePath(mediaItem.url);
        const isVideo = mediaItem.type === 'video' || mediaItem.url.endsWith('.mp4');

        const thumbnail = thumbnailsContainer.createDiv();
        thumbnail.style.cssText = 'position: relative; width: 60px; height: 60px; flex-shrink: 0; border-radius: 4px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;';

        if (isVideo) {
          // Video thumbnail - show play icon overlay
          const videoThumb = thumbnail.createEl('video', {
            attr: {
              src: resourcePath,
              preload: 'metadata'
            }
          });
          videoThumb.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

          // Play icon overlay
          const playOverlay = thumbnail.createDiv();
          playOverlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(0, 0, 0, 0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center;';
          const playIcon = playOverlay.createDiv({ cls: 'w-3 h-3 text-white' });
          setIcon(playIcon, 'play');
        } else {
          // Image thumbnail
          const imgThumb = thumbnail.createEl('img', {
            attr: {
              src: resourcePath,
              alt: `Thumbnail ${i + 1}`
            }
          });
          imgThumb.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        }

        // Click to navigate
        thumbnail.addEventListener('click', (e) => {
          e.stopPropagation();
          showMedia(i);
        });

        // Active state
        if (i === 0) {
          thumbnail.style.borderColor = 'var(--interactive-accent)';
        }

        thumbnailElements.push(thumbnail);
      }

      // Counter indicator (bottom-right, above thumbnails)
      const counter = carouselContainer.createDiv();
      // Position above thumbnails: thumbnail height (60px) + padding (12px * 2) + gap (12px) = ~96px
      counter.style.cssText = 'position: absolute; bottom: 96px; right: 12px; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.15); color: rgba(255, 255, 255, 0.7); font-size: 11px; font-weight: 500; z-index: 10; backdrop-filter: blur(8px);';
      counter.setText(`1/${media.length}`);

      // Navigation functions
      const showMedia = (index: number) => {
        mediaElements.forEach((element, i) => {
          element.style.display = i === index ? 'block' : 'none';
          // Pause videos when hidden
          if (element instanceof HTMLVideoElement) {
            if (i !== index) {
              element.pause();
            }
          }
        });

        // Update thumbnail active state
        thumbnailElements.forEach((thumb, i) => {
          thumb.style.borderColor = i === index ? 'var(--interactive-accent)' : 'transparent';
        });

        counter.setText(`${index + 1}/${media.length}`);
        currentIndex = index;
      };

      // Keyboard navigation
      mediaContainer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.stopPropagation();
          const newIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1;
          showMedia(newIndex);
        } else if (e.key === 'ArrowRight') {
          e.stopPropagation();
          const newIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0;
          showMedia(newIndex);
        }
      });
    }
  }
}
