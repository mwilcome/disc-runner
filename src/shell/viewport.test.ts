import { describe, expect, it } from 'vitest';
import {
  isAndroid,
  isIphone,
  safariChromeOpen,
  shouldKeepSafariScroll,
  shouldOfferChromeCollapse,
  shouldRequestFullscreen,
  dockSwipe,
  swipeUp,
  visualFrame,
} from './viewport';

describe('landscape shell', () => {
  it('detects an iPhone and a usable visual frame', () => {
    expect(isIphone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIphone('Mozilla/5.0 (Macintosh)')).toBe(false);
    expect(visualFrame({ width: 800, height: 360, offsetTop: 20, offsetLeft: 0 })).toEqual({
      top: 20,
      left: 0,
      width: 800,
      height: 360,
    });
    expect(visualFrame(null)).toBeNull();
  });

  it('asks for a swipe when landscape Safari chrome is still open', () => {
    const chromeOpen = safariChromeOpen({
      standalone: false,
      width: 800,
      height: 340,
      vvHeight: 300,
      vvOffsetTop: 0,
      screenWidth: 844,
      screenHeight: 390,
    });
    expect(chromeOpen).toBe(true);
    expect(shouldOfferChromeCollapse({ iphone: true, standalone: false, chromeOpen })).toBe(true);
    expect(shouldOfferChromeCollapse({ iphone: true, standalone: true, chromeOpen })).toBe(false);
    expect(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(false);
    expect(shouldRequestFullscreen({ android: true, standalone: false, fullscreen: false })).toBe(true);
    expect(shouldRequestFullscreen({ android: true, fullscreen: true })).toBe(false);
    expect(shouldRequestFullscreen({ android: false })).toBe(false);
    expect(shouldKeepSafariScroll({ iphone: true, standalone: false, width: 800, height: 340 })).toBe(true);
    expect(shouldKeepSafariScroll({ iphone: true, width: 340, height: 800 })).toBe(false);
    expect(shouldOfferChromeCollapse({ android: true, standalone: false, fullscreen: false })).toBe(true);
    expect(swipeUp(10, -80)).toBe(true);
    expect(swipeUp(-80, -10)).toBe(false);
    expect(dockSwipe(-120, -8)).toBe(false);
    expect(dockSwipe(4, -70)).toBe(true);
    expect(dockSwipe(-90, -20)).toBe(false);
    expect(
      safariChromeOpen({
        standalone: true,
        width: 800,
        height: 340,
        vvHeight: 300,
        vvOffsetTop: 0,
        screenWidth: 844,
        screenHeight: 390,
      }),
    ).toBe(false);
  });
});
