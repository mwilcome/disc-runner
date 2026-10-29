/**
 * Landscape shell. iPhone Safari has no page fullscreen. The toolbars collapse
 * only when the viewport itself scrolls, which is what Mars Tanks does: a tall
 * document, overflow visible, and no preventDefault while the bars are open.
 */

const COLLAPSE_QUIET_MS = 600;

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

export function isAndroid(ua = ''): boolean {
  return /Android/i.test(ua);
}

export function shouldKeepSafariScroll(args: {
  iphone?: boolean;
  standalone?: boolean;
  width?: number;
  height?: number;
} = {}): boolean {
  return Boolean(args.iphone && !args.standalone && (args.width ?? 0) > (args.height ?? 0));
}

/** Android Chrome can take the page fullscreen. iPhone Safari cannot. */
export function shouldRequestFullscreen(args: {
  android?: boolean;
  standalone?: boolean;
  fullscreen?: boolean;
} = {}): boolean {
  return Boolean(args.android && !args.standalone && !args.fullscreen);
}

export function shouldOfferChromeCollapse(args: {
  iphone?: boolean;
  android?: boolean;
  standalone?: boolean;
  chromeOpen?: boolean;
  fullscreen?: boolean;
} = {}): boolean {
  if (args.standalone || args.fullscreen) return false;
  if (args.android) return true;
  return Boolean(args.iphone && args.chromeOpen);
}

/** While Safari's bars are up, a touch must be allowed to scroll the viewport. */
export function safariOwnsSwipe(args: { chromeOpen?: boolean; gesturing?: boolean } = {}): boolean {
  return Boolean(args.chromeOpen || args.gesturing);
}

/** An upward swipe that is hiding the browser should not also throw the disc. */
export function shouldDropThrowForChrome(args: { chromeGesture?: boolean; dx: number; dy: number }): boolean {
  return Boolean(args.chromeGesture && args.dy < -24 && Math.abs(args.dy) > Math.abs(args.dx));
}

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export async function enterFullscreen(doc: Document = document, win: Window = window): Promise<void> {
  const el = doc.documentElement as FullscreenElement;
  const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!request) return;
  try {
    await request();
  } catch {
    return;
  }
  const orientation = win.screen?.orientation as (ScreenOrientation & { lock?: (type: string) => Promise<void> }) | undefined;
  try {
    await orientation?.lock?.('landscape');
  } catch {
    /* Android may refuse the lock until fullscreen settles. */
  }
}

export function installViewport(doc: Document = document, win: Window = window): void {
  const root = doc.documentElement;
  const ua = win.navigator?.userAgent || '';
  const iphone = isIphone(ua);
  const android = isAndroid(ua);
  const ios = isIOSDevice(ua, {
    maxTouchPoints: win.navigator?.maxTouchPoints || 0,
    platform: win.navigator?.platform || '',
  });

  const displayMode = (): string => {
    if (win.matchMedia?.('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (win.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
    return 'browser';
  };
  const fullscreenNow = () => {
    const anyDoc = doc as Document & { webkitFullscreenElement?: Element | null };
    return Boolean(doc.fullscreenElement || anyDoc.webkitFullscreenElement);
  };

  let scheduled = false;
  let wasOpen = false;
  let quietUntil = 0;
  let askedFullscreen = false;

  const apply = () => {
    const nav = win.navigator as Navigator & { standalone?: boolean };
    const standalone = isStandaloneDisplay({
      standalone: nav.standalone === true,
      displayMode: displayMode(),
    });
    const fullscreen = fullscreenNow();
    root.classList.toggle('standalone', standalone);
    const frame = win.visualViewport ? visualFrame(win.visualViewport) : null;
    const pin = Boolean(ios && !standalone && frame);
    root.classList.toggle('vv', pin);
    const setVar = (name: string, value: string | null) => {
      if (value == null) {
        if (root.style.getPropertyValue(name)) root.style.removeProperty(name);
        return;
      }
      if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
    };
    if (!pin || !frame) {
      setVar('--vv-top', null);
      setVar('--vv-left', null);
      setVar('--vv-width', null);
      setVar('--vv-height', null);
    } else {
      setVar('--vv-top', `${frame.top}px`);
      setVar('--vv-left', `${frame.left}px`);
      setVar('--vv-width', `${frame.width}px`);
      setVar('--vv-height', `${frame.height}px`);
    }
    const width = win.innerWidth || 0;
    const height = win.innerHeight || 0;
    const rawOpen = shouldOfferChromeCollapse({
      iphone,
      standalone,
      fullscreen,
      chromeOpen: safariChromeOpen({
        standalone,
        width,
        height,
        vvHeight: frame?.height ?? height,
        vvOffsetTop: frame?.top ?? 0,
        screenWidth: win.screen?.width || 0,
        screenHeight: win.screen?.height || 0,
      }),
    });
    const now = win.performance?.now?.() ?? Date.now();
    if (wasOpen && !rawOpen) quietUntil = now + COLLAPSE_QUIET_MS;
    wasOpen = rawOpen;
    root.classList.toggle('ios-scroll', shouldKeepSafariScroll({ iphone, standalone, width, height }));
    root.classList.toggle('chrome-open', rawOpen && now >= quietUntil);
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    win.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  };

  const owns = () => safariOwnsSwipe({
    chromeOpen: root.classList.contains('chrome-open'),
    gesturing: root.classList.contains('chrome-gesture'),
  });

  doc.addEventListener('touchstart', () => {
    if (root.classList.contains('chrome-open')) root.classList.add('chrome-gesture');
  }, { passive: true });
  doc.addEventListener('touchmove', (event) => {
    if (owns()) return;
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  const endGesture = (event: TouchEvent) => {
    if (event.type === 'touchcancel' || event.touches.length === 0) {
      win.requestAnimationFrame(() => root.classList.remove('chrome-gesture'));
    }
    if (askedFullscreen) return;
    if (!shouldRequestFullscreen({ android, standalone: root.classList.contains('standalone'), fullscreen: fullscreenNow() })) return;
    askedFullscreen = true;
    void enterFullscreen(doc, win).then(schedule);
  };
  doc.addEventListener('touchend', endGesture, { passive: true });
  doc.addEventListener('touchcancel', endGesture, { passive: true });
  const blockPinch = (event: Event) => event.preventDefault();
  doc.addEventListener('gesturestart', blockPinch, { passive: false });
  doc.addEventListener('gesturechange', blockPinch, { passive: false });

  apply();
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', schedule);
  win.addEventListener('pageshow', schedule);
  doc.addEventListener('fullscreenchange', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);
  doc.addEventListener('contextmenu', (event) => event.preventDefault());
}
