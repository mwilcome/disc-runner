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

export function swipeUp(dx: number, dy: number, min = 36): boolean {
  return dy < -min && Math.abs(dy) > Math.abs(dx) * 1.4;
}

/** True only for the swipe that hides browser chrome. A throw drag stays with the game. */
export function shouldYieldTouchToBrowser(args: {
  chromeOpen?: boolean;
  wantsFullscreen?: boolean;
  dx: number;
  dy: number;
}): boolean {
  if (args.chromeOpen && swipeUp(args.dx, args.dy, 18)) return true;
  if (args.wantsFullscreen && swipeUp(args.dx, args.dy, 56)) return true;
  return false;
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

  let startX = 0;
  let startY = 0;
  let armFullscreen = false;

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
    const width = win.innerWidth || 0;
    const height = win.innerHeight || 0;
    const chromeOpen = safariChromeOpen({
      standalone,
      width,
      height,
      vvHeight: frame?.height ?? height,
      vvOffsetTop: frame?.top ?? 0,
      screenWidth: win.screen?.width || 0,
      screenHeight: win.screen?.height || 0,
    });
    const chrome = shouldOfferChromeCollapse({
      iphone,
      android,
      standalone,
      fullscreen,
      chromeOpen,
    });
    root.classList.toggle('ios-scroll', shouldKeepSafariScroll({ iphone, standalone, width, height }) && chrome);
    root.classList.toggle('chrome-open', chrome);
  };

  const onStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    armFullscreen = false;
  };
  const onMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || event.touches.length !== 1) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const wantsFullscreen = shouldRequestFullscreen({
      android,
      standalone: root.classList.contains('standalone'),
      fullscreen: fullscreenNow(),
    });
    if (!shouldYieldTouchToBrowser({
      chromeOpen: root.classList.contains('chrome-open') && root.classList.contains('ios-scroll'),
      wantsFullscreen,
      dx,
      dy,
    })) return;
    root.classList.add('chrome-gesture');
    if (wantsFullscreen) armFullscreen = true;
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  const onEnd = (event: TouchEvent) => {
    if (event.type === 'touchcancel' || event.touches.length === 0) root.classList.remove('chrome-gesture');
    if (armFullscreen) {
      armFullscreen = false;
      void enterFullscreen(doc, win).then(apply);
    }
  };

  apply();
  win.addEventListener('resize', apply);
  win.addEventListener('orientationchange', apply);
  doc.addEventListener('fullscreenchange', apply);
  win.visualViewport?.addEventListener('resize', apply);
  win.visualViewport?.addEventListener('scroll', apply);
  doc.addEventListener('touchstart', onStart, { passive: true, capture: true });
  doc.addEventListener('touchmove', onMove, { passive: false, capture: true });
  doc.addEventListener('touchend', onEnd, { passive: true, capture: true });
  doc.addEventListener('touchcancel', onEnd, { passive: true, capture: true });
  const blockPinch = (event: Event) => event.preventDefault();
  doc.addEventListener('gesturestart', blockPinch, { passive: false });
  doc.addEventListener('gesturechange', blockPinch, { passive: false });
  doc.addEventListener('contextmenu', blockPinch);
}
