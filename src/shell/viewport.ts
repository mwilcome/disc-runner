/** Landscape shell. iPhone Safari has no page fullscreen; scrolling collapses the toolbars. */

export const SAFARI_CHROME_GAP = 40;

export function isIphone(ua = ''): boolean {
  return /iPhone|iPod/.test(ua);
}

export function isIOSDevice(ua = '', extra: { maxTouchPoints?: number; platform?: string } = {}): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return extra.platform === 'MacIntel' && (extra.maxTouchPoints ?? 0) > 1;
}

export function isStandaloneDisplay(flags: { standalone?: boolean; displayMode?: string } = {}): boolean {
  return flags.standalone === true || flags.displayMode === 'standalone' || flags.displayMode === 'fullscreen';
}

export function visualFrame(viewport: { width?: number; height?: number; offsetTop?: number; offsetLeft?: number } | null): {
  top: number;
  left: number;
  width: number;
  height: number;
} | null {
  if (!viewport) return null;
  const width = Math.round(Number(viewport.width) || 0);
  const height = Math.round(Number(viewport.height) || 0);
  if (width < 2 || height < 2) return null;
  return {
    top: Math.round(Number(viewport.offsetTop) || 0),
    left: Math.round(Number(viewport.offsetLeft) || 0),
    width,
    height,
  };
}

export function safariChromeOpen(args: {
  standalone?: boolean;
  width?: number;
  height?: number;
  vvHeight?: number;
  vvOffsetTop?: number;
  screenWidth?: number;
  screenHeight?: number;
} = {}): boolean {
  if (args.standalone) return false;
  if (!((args.width ?? 0) > (args.height ?? 0))) return false;
  const shortSide = Math.min(Number(args.screenWidth) || 0, Number(args.screenHeight) || 0);
  const visible = (Number(args.vvHeight) || 0) + (Number(args.vvOffsetTop) || 0);
  if (shortSide <= 0 || visible <= 0) return false;
  return visible < shortSide - SAFARI_CHROME_GAP;
}

export function shouldOfferChromeCollapse(args: {
  iphone?: boolean;
  standalone?: boolean;
  chromeOpen?: boolean;
} = {}): boolean {
  return Boolean(args.iphone && !args.standalone && args.chromeOpen);
}

export function installViewport(doc: Document = document, win: Window = window): void {
  const root = doc.documentElement;
  const ua = win.navigator?.userAgent || '';
  const iphone = isIphone(ua);
  const ios = isIOSDevice(ua, {
    maxTouchPoints: win.navigator?.maxTouchPoints || 0,
    platform: win.navigator?.platform || '',
  });

  const displayMode = (): string => {
    if (win.matchMedia?.('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (win.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
    return 'browser';
  };

  const apply = () => {
    const nav = win.navigator as Navigator & { standalone?: boolean };
    const standalone = isStandaloneDisplay({
      standalone: nav.standalone === true,
      displayMode: displayMode(),
    });
    root.classList.toggle('standalone', standalone);
    const frame = win.visualViewport ? visualFrame(win.visualViewport) : null;
    const pin = Boolean(ios && !standalone && frame);
    root.classList.toggle('vv', pin);
    if (!pin || !frame) {
      root.style.removeProperty('--vv-top');
      root.style.removeProperty('--vv-left');
      root.style.removeProperty('--vv-width');
      root.style.removeProperty('--vv-height');
    } else {
      root.style.setProperty('--vv-top', `${frame.top}px`);
      root.style.setProperty('--vv-left', `${frame.left}px`);
      root.style.setProperty('--vv-width', `${frame.width}px`);
      root.style.setProperty('--vv-height', `${frame.height}px`);
    }
    const chrome = shouldOfferChromeCollapse({
      iphone,
      standalone,
      chromeOpen: safariChromeOpen({
        standalone,
        width: win.innerWidth || 0,
        height: win.innerHeight || 0,
        vvHeight: frame?.height ?? win.innerHeight,
        vvOffsetTop: frame?.top ?? 0,
        screenWidth: win.screen?.width || 0,
        screenHeight: win.screen?.height || 0,
      }),
    });
    root.classList.toggle('chrome-open', chrome);
  };

  apply();
  win.addEventListener('resize', apply);
  win.addEventListener('orientationchange', apply);
  win.visualViewport?.addEventListener('resize', apply);
  win.visualViewport?.addEventListener('scroll', apply);
  const blockPinch = (event: Event) => event.preventDefault();
  doc.addEventListener('gesturestart', blockPinch, { passive: false });
  doc.addEventListener('gesturechange', blockPinch, { passive: false });
  doc.addEventListener('contextmenu', blockPinch);
}
