import { describe, expect, it } from 'vitest';
import { isIphone, safariChromeOpen, shouldOfferChromeCollapse, visualFrame } from './viewport';

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
