/**
 * YouTube Player Controller - Controls YouTube iframe via postMessage API
 * Single Responsibility: YouTube iframe control via postMessage API
 * @see https://medium.com/@mihauco/youtube-iframe-api-without-youtube-iframe-api-f0ac5fcf7c74
 */
export class YouTubePlayerController {
  private iframe: HTMLIFrameElement;
  private ready = false;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;

    // Wait for iframe to load
    this.iframe.addEventListener('load', () => {
      this.ready = true;
      // Enable listening mode to receive player state updates
      this.sendCommand('listening');
    });
  }

  private sendCommand(func: string, args: any[] = []): void {
    if (!this.ready) {
      console.warn('[YouTubePlayer] Not ready yet');
      return;
    }

    const message = JSON.stringify({
      event: func === 'listening' ? 'listening' : 'command',
      func: func === 'listening' ? undefined : func,
      args
    });

    this.iframe.contentWindow?.postMessage(message, '*');
  }

  /**
   * Seek to specific time in video (in seconds)
   */
  public seekTo(seconds: number): void {
    this.sendCommand('seekTo', [seconds, true]);
  }

  /**
   * Play video
   */
  public play(): void {
    this.sendCommand('playVideo');
  }

  /**
   * Pause video
   */
  public pause(): void {
    this.sendCommand('pauseVideo');
  }

  /**
   * Mute video
   */
  public mute(): void {
    this.sendCommand('mute');
  }

  /**
   * Unmute video
   */
  public unmute(): void {
    this.sendCommand('unMute');
  }
}
