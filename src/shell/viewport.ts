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

/** Upward swipe on the bottom bar, not a slingshot drag on the field. */
export function dockSwipe(dx: number, dy: number): boolean {
  return swipeUp(dx, dy, 28);
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

  let chromeLocked = false;
  let scheduled = false;
  let dockX = 0;
  let dockY = 0;

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
    const landscape = width > height;
    const chromeOpen = safariChromeOpen({
      standalone,
      width,
      height,
      vvHeight: frame?.height ?? height,
      vvOffsetTop: frame?.top ?? 0,
      screenWidth: win.screen?.width || 0,
      screenHeight: win.screen?.height || 0,
    });
    if (!landscape || !iphone) chromeLocked = false;
    else if (!chromeOpen || fullscreen) chromeLocked = true;
    const chrome = !chromeLocked && shouldOfferChromeCollapse({
      iphone,
      android,
      standalone,
      fullscreen,
      chromeOpen,
    });
    const scrolling = shouldKeepSafariScroll({ iphone, standalone, width, height }) && chrome;
    root.classList.toggle('ios-scroll', scrolling);
    root.classList.toggle('chrome-open', chrome);
    root.classList.toggle('chrome-locked', chromeLocked && landscape && !fullscreen && !standalone);
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    win.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  };

  const dock = doc.getElementById('chrome-dock');
  dock?.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    dockX = touch.clientX;
    dockY = touch.clientY;
  }, { passive: true });
  dock?.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    if (!touch || !root.classList.contains('ios-scroll')) return;
    const dx = touch.clientX - dockX;
    const dy = touch.clientY - dockY;
    if (!dockSwipe(dx, dy) || win.scrollY > 8) return;
    win.scrollTo(0, 80);
  }, { passive: true });
  dock?.addEventListener('click', () => {
    if (!shouldRequestFullscreen({ android, standalone: root.classList.contains('standalone'), fullscreen: fullscreenNow() })) return;
    void enterFullscreen(doc, win).then(schedule);
  });

  apply();
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', schedule);
  doc.addEventListener('fullscreenchange', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);
  doc.addEventListener('contextmenu', (event) => event.preventDefault());
}
