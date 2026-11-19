import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { act, render, screen } from "@testing-library/react";
import InitialLoader, {
  LOADER_SEEN_KEY,
} from "@/components/animations/InitialLoader";

type TweenVarsRecord = Record<string, unknown>;

interface AnimationStub {
  pause: Mock<() => AnimationStub>;
  play: Mock<() => AnimationStub>;
  resume: Mock<() => AnimationStub>;
  restart: Mock<() => AnimationStub>;
  kill: Mock<() => AnimationStub>;
  revert: Mock<() => AnimationStub>;
  paused: Mock<(value?: boolean) => boolean | AnimationStub>;
  progress: Mock<(value?: number) => number | AnimationStub>;
  timeScale: Mock<() => AnimationStub>;
  invalidate: Mock<() => AnimationStub>;
  totalProgress: Mock<() => number>;
  eventCallback: Mock<() => AnimationStub>;
}

interface RecordedToCall {
  target: unknown;
  vars: TweenVarsRecord;
  tween: AnimationStub;
}

const gsapMockState = vi.hoisted(() => {
  const toCalls: RecordedToCall[] = [];
  const revertSpy = vi.fn<() => void>();

  const createAnimationStub = (initialPaused = false): AnimationStub => {
    let isPaused = initialPaused;

    const stub: AnimationStub = {
      pause: vi.fn(() => {
        isPaused = true;
        return stub;
      }),
      play: vi.fn(() => {
        isPaused = false;
        return stub;
      }),
      resume: vi.fn(() => {
        isPaused = false;
        return stub;
      }),
      restart: vi.fn(() => {
        isPaused = false;
        return stub;
      }),
      kill: vi.fn(() => stub),
      revert: vi.fn(() => {
        revertSpy();
        return stub;
      }),
      paused: vi.fn((value?: boolean): boolean | AnimationStub => {
        if (typeof value === "boolean") {
          isPaused = value;
          return stub;
        }
        return isPaused;
      }),
      progress: vi.fn((value?: number): number | AnimationStub => {
        if (typeof value === "number") {
          return stub;
        }
        return 0;
      }),
      timeScale: vi.fn(() => stub),
      invalidate: vi.fn(() => stub),
      totalProgress: vi.fn(() => 0),
      eventCallback: vi.fn(() => stub),
    };

    return stub;
  };

  interface MockGsapContext {
    conditions: Record<string, boolean>;
    isReverted: boolean;
    add: (fn: () => void) => void;
  }

  const contextMock = vi.fn(
    (
      func?: (context: MockGsapContext) => void | (() => void),
      _scope?: unknown
    ) => {
      void _scope;
      const cleanups: Array<() => void> = [];
      const ctx: MockGsapContext = {
        conditions: {},
        isReverted: false,
        add: (fn: () => void) => fn(),
      };
      if (func) {
        const cleanup = func(ctx);
        if (typeof cleanup === "function") {
          cleanups.push(cleanup);
        }
      }
      return {
        revert: vi.fn(() => {
          ctx.isReverted = true;
          while (cleanups.length > 0) {
            const cleanup = cleanups.pop();
            cleanup?.();
          }
          revertSpy();
        }),
        kill: vi.fn(() => {
          ctx.isReverted = true;
          cleanups.length = 0;
        }),
        add: vi.fn((fn: () => void) => fn()),
      };
    }
  );

  const gsapMock = {
    set: vi.fn(() => createAnimationStub()),
    to: vi.fn((target: unknown, vars: TweenVarsRecord = {}) => {
      const tween = createAnimationStub(Boolean(vars.paused));
      toCalls.push({ target, vars, tween });
      return tween;
    }),
    fromTo: vi.fn((_target: unknown, _fromVars: TweenVarsRecord, toVars: TweenVarsRecord) =>
      createAnimationStub(Boolean(toVars?.paused))
    ),
    timeline: vi.fn((vars?: TweenVarsRecord) =>
      createAnimationStub(Boolean(vars?.paused))
    ),
    delayedCall: vi.fn(() => createAnimationStub()),
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      fps: vi.fn(),
      lagSmoothing: vi.fn(),
    },
    killTweensOf: vi.fn(),
    context: contextMock,
  };

  const reset = () => {
    toCalls.length = 0;
    revertSpy.mockClear();
    gsapMock.set.mockClear();
    gsapMock.to.mockClear();
    gsapMock.fromTo.mockClear();
    gsapMock.timeline.mockClear();
    gsapMock.delayedCall.mockClear();
    gsapMock.ticker.add.mockClear();
    gsapMock.ticker.remove.mockClear();
    gsapMock.killTweensOf.mockClear();
    contextMock.mockClear();
  };

  return {
    toCalls,
    revertSpy,
    gsapMock,
    reset,
  };
});

vi.mock("gsap", () => ({
  default: gsapMockState.gsapMock,
  gsap: gsapMockState.gsapMock,
}));

vi.mock("next/font/google", () => ({
  JetBrains_Mono: () => ({ className: "mock-jetbrains-mono" }),
  Fraunces: () => ({ className: "mock-fraunces" }),
}));

const CELL_WIDTH = 180;
const CELL_HEIGHT = 204;
const GUTTER = 4;
const STRIDE_X = 188;
const STRIDE_Y = 212;
const SHEET_WIDTH = 1504;
const SHEET_HEIGHT = 1272;
const BACKFLIP_SHEET_SRC = "skeleton-backflip-sheet.v3.webp";

function makeDomRect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

describe("InitialLoader & LoaderBackflipSkeleton", () => {
  const OriginalDecode = HTMLImageElement.prototype.decode;
  const OriginalGetContext = HTMLCanvasElement.prototype.getContext;
  const OriginalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;
  const OriginalNaturalWidth = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "naturalWidth"
  );
  const OriginalNaturalHeight = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "naturalHeight"
  );
  const OriginalComplete = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "complete"
  );
  const OriginalConnection = Object.getOwnPropertyDescriptor(
    navigator,
    "connection"
  );
  const OriginalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
  const OriginalMatchMedia = window.matchMedia;

  let decodedImages: HTMLImageElement[] = [];
  let decodedSrcs: string[] = [];
  let decodedSet = new WeakSet<HTMLImageElement>();
  let decodeSpy: Mock<(this: HTMLImageElement) => Promise<void>>;
  let mockCanvasCtx: {
    clearRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    scale: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    setTransform: ReturnType<typeof vi.fn>;
    resetTransform: ReturnType<typeof vi.fn>;
    imageSmoothingEnabled: boolean;
    imageSmoothingQuality: ImageSmoothingQuality;
  };

  function getImgSrc(img: HTMLImageElement): string {
    return img.getAttribute("src") ?? "";
  }

  function findBackflipTweenCall(): RecordedToCall | undefined {
    return gsapMockState.toCalls.find((call) => call.vars.repeat === 0);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    delete document.documentElement.dataset.loaderSeen;
    gsapMockState.reset();
    decodedImages = [];
    decodedSrcs = [];
    decodedSet = new WeakSet<HTMLImageElement>();
    document.body.style.overflow = "";

    Object.defineProperty(document, "hidden", {
      configurable: true,
      writable: true,
      value: false,
    });

    Object.defineProperty(navigator, "connection", {
      configurable: true,
      writable: true,
      value: { saveData: false },
    });

    window.matchMedia = vi.fn(
      (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })
    );

    HTMLElement.prototype.getBoundingClientRect = function () {
      const testId = this.getAttribute("data-testid");
      if (
        testId === "loader-backflip-stage" ||
        testId === "loader-backflip-canvas" ||
        testId === "loader-backflip-poster"
      ) {
        return makeDomRect(CELL_WIDTH, CELL_HEIGHT);
      }
      return makeDomRect(0, 0);
    };

    decodeSpy = vi.fn(function (this: HTMLImageElement) {
      decodedImages.push(this);
      decodedSrcs.push(getImgSrc(this));
      decodedSet.add(this);
      return Promise.resolve();
    });
    HTMLImageElement.prototype.decode = decodeSpy;

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        const img = this as HTMLImageElement;
        const src = getImgSrc(img);
        if (!src) return 0;
        if (src.includes(BACKFLIP_SHEET_SRC)) {
          return decodedSet.has(img) ? SHEET_WIDTH : 0;
        }
        return CELL_WIDTH;
      },
    });

    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        const img = this as HTMLImageElement;
        const src = getImgSrc(img);
        if (!src) return 0;
        if (src.includes(BACKFLIP_SHEET_SRC)) {
          return decodedSet.has(img) ? SHEET_HEIGHT : 0;
        }
        return CELL_HEIGHT;
      },
    });

    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        const img = this as HTMLImageElement;
        const src = getImgSrc(img);
        if (!src) return false;
        if (src.includes(BACKFLIP_SHEET_SRC)) {
          return decodedSet.has(img);
        }
        return true;
      },
    });

    mockCanvasCtx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      resetTransform: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(
      (contextId: string): RenderingContext | null => {
        if (contextId === "2d") {
          return mockCanvasCtx as unknown as CanvasRenderingContext2D;
        }
        return null;
      }
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.sessionStorage.clear();
    delete document.documentElement.dataset.loaderSeen;
    document.body.style.overflow = "";
    HTMLImageElement.prototype.decode = OriginalDecode;
    HTMLCanvasElement.prototype.getContext = OriginalGetContext;
    HTMLElement.prototype.getBoundingClientRect = OriginalGetBoundingClientRect;
    window.matchMedia = OriginalMatchMedia;

    if (OriginalNaturalWidth) {
      Object.defineProperty(
        HTMLImageElement.prototype,
        "naturalWidth",
        OriginalNaturalWidth
      );
    }
    if (OriginalNaturalHeight) {
      Object.defineProperty(
        HTMLImageElement.prototype,
        "naturalHeight",
        OriginalNaturalHeight
      );
    }
    if (OriginalComplete) {
      Object.defineProperty(
        HTMLImageElement.prototype,
        "complete",
        OriginalComplete
      );
    }
    if (OriginalConnection) {
      Object.defineProperty(navigator, "connection", OriginalConnection);
    } else {
      delete (navigator as Navigator & { connection?: unknown }).connection;
    }
    if (OriginalHidden) {
      Object.defineProperty(document, "hidden", OriginalHidden);
    }
  });

  it("renders overlay, locks body scroll, decodes sprite once, draws frame 0, starts one-shot GSAP tween, and ignores progress rAF ticks", async () => {
    render(<InitialLoader />);

    expect(document.getElementById("initial-loader-overlay")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByTestId("loader-backflip-stage")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });

    expect(screen.getByTestId("loader-backflip-canvas")).toBeInTheDocument();

    const sheetDecodes = decodedSrcs.filter((src) =>
      src.includes(BACKFLIP_SHEET_SRC)
    );
    expect(sheetDecodes).toHaveLength(1);

    expect(mockCanvasCtx.drawImage).toHaveBeenCalled();
    const firstDraw = mockCanvasCtx.drawImage.mock.calls[0];
    expect(firstDraw[1]).toBe(GUTTER);
    expect(firstDraw[2]).toBe(GUTTER);
    expect(firstDraw[3]).toBe(CELL_WIDTH);
    expect(firstDraw[4]).toBe(CELL_HEIGHT);

    const tweenCall = findBackflipTweenCall();
    expect(tweenCall).toBeDefined();
    expect(tweenCall?.vars.repeat).toBe(0);
    expect(tweenCall?.vars.duration).toBe(1.45);
    expect(gsapMockState.gsapMock.to).toHaveBeenCalledTimes(1);

    // Progress rAF ticks must not re-invoke img.decode() or restart GSAP tween
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(
      decodedSrcs.filter((src) => src.includes(BACKFLIP_SHEET_SRC))
    ).toHaveLength(1);
    expect(gsapMockState.gsapMock.to).toHaveBeenCalledTimes(1);
  });

  it("clamps frame index to 47 when playhead.frame reaches 48 on completion and dismisses cleanly", async () => {
    render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const tweenCall = findBackflipTweenCall();
    expect(tweenCall).toBeDefined();

    mockCanvasCtx.drawImage.mockClear();

    act(() => {
      const playhead = tweenCall!.target as Record<string, number>;
      const frameKey =
        "frame" in playhead
          ? "frame"
          : (Object.keys(playhead).find(
              (key) => typeof playhead[key] === "number"
            ) ?? "frame");
      playhead[frameKey] = 48;
      (tweenCall!.vars.onUpdate as (() => void) | undefined)?.();
      (tweenCall!.vars.onComplete as (() => void) | undefined)?.();
    });

    const expectedSx = 7 * STRIDE_X + GUTTER; // col 7 -> 1320
    const expectedSy = 5 * STRIDE_Y + GUTTER; // row 5 -> 1064

    const clampedDraw = mockCanvasCtx.drawImage.mock.calls.find(
      (args) =>
        args[1] === expectedSx &&
        args[2] === expectedSy &&
        args[3] === CELL_WIDTH &&
        args[4] === CELL_HEIGHT
    );
    expect(clampedDraw).toBeDefined();

    // Never draws out-of-range frame 48 (col 8, row 6)
    const outOfRangeDraw = mockCanvasCtx.drawImage.mock.calls.find(
      (args) => args[1] === 8 * STRIDE_X + GUTTER
    );
    expect(outOfRangeDraw).toBeUndefined();

    // Advance past BASE_DURATION_MS (1400) + HOLD_COMPLETE_MS (150)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(document.getElementById("initial-loader-overlay")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(window.sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  it("skips sheet fetch under saveData, renders loader-backflip-poster, and dismisses cleanly", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      writable: true,
      value: { saveData: true },
    });

    render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("loader-backflip-stage")).toBeInTheDocument();
    expect(screen.getByTestId("loader-backflip-poster")).toBeInTheDocument();
    expect(
      decodedSrcs.some((src) => src.includes(BACKFLIP_SHEET_SRC))
    ).toBe(false);
    expect(findBackflipTweenCall()).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(document.getElementById("initial-loader-overlay")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(window.sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  it("aborts pending image, keeps poster fallback, and dismisses cleanly when img.decode() rejects", async () => {
    const sheetDecodeTargets: HTMLImageElement[] = [];
    HTMLImageElement.prototype.decode = vi.fn(function (this: HTMLImageElement) {
      decodedImages.push(this);
      decodedSrcs.push(getImgSrc(this));
      if (getImgSrc(this).includes(BACKFLIP_SHEET_SRC)) {
        sheetDecodeTargets.push(this);
        return Promise.reject(new Error("WebP decode failed"));
      }
      decodedSet.add(this);
      return Promise.resolve();
    });

    render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(sheetDecodeTargets).toHaveLength(1);
    expect(sheetDecodeTargets[0].getAttribute("src") ?? "").toBe("");
    expect(screen.getByTestId("loader-backflip-poster")).toBeInTheDocument();
    expect(findBackflipTweenCall()).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    expect(document.getElementById("initial-loader-overlay")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(window.sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  it("aborts pending image after START_DEADLINE_MS (> 600ms), keeps poster fallback, and dismisses cleanly", async () => {
    let resolveLateDecode: (() => void) | undefined;
    HTMLImageElement.prototype.decode = vi.fn(function (this: HTMLImageElement) {
      decodedImages.push(this);
      decodedSrcs.push(getImgSrc(this));
      if (getImgSrc(this).includes(BACKFLIP_SHEET_SRC)) {
        return new Promise<void>((resolve) => {
          resolveLateDecode = () => {
            decodedSet.add(this);
            resolve();
          };
        });
      }
      decodedSet.add(this);
      return Promise.resolve();
    });

    render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const pendingSheetImgs = decodedImages.filter((img) =>
      getImgSrc(img).includes(BACKFLIP_SHEET_SRC)
    );
    expect(pendingSheetImgs).toHaveLength(1);
    const sheetImgEl = pendingSheetImgs[0];

    // Cross START_DEADLINE_MS = 600ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(sheetImgEl.getAttribute("src") ?? "").toBe("");
    expect(screen.getByTestId("loader-backflip-poster")).toBeInTheDocument();

    // Even if the aborted decode promise settles late, GSAP must not start
    await act(async () => {
      resolveLateDecode?.();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(findBackflipTweenCall()).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(document.getElementById("initial-loader-overlay")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(window.sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  it("enforces MAX_LOADER_MS safety ceiling when GSAP onComplete is delayed", async () => {
    render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(findBackflipTweenCall()).toBeDefined();

    // Past BASE_DURATION_MS + HOLD_COMPLETE_MS, before MAX_LOADER_MS (2400ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });
    expect(document.getElementById("initial-loader-overlay")).not.toBeNull();

    // Past MAX_LOADER_MS (2400ms) + HOLD_COMPLETE_MS (150ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(document.getElementById("initial-loader-overlay")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(window.sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  it("resets canvas dimensions, restores body overflow, cancels timers/rAF, and reverts GSAP context on unmount", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const cancelRafSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    document.body.style.overflow = "auto";

    const { unmount } = render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const canvas = screen.getByTestId(
      "loader-backflip-canvas"
    ) as HTMLCanvasElement;
    expect(canvas.width).toBe(CELL_WIDTH);
    expect(canvas.height).toBe(CELL_HEIGHT);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(document.body.style.overflow).toBe("auto");
    expect(gsapMockState.revertSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(cancelRafSpy).toHaveBeenCalled();

    // Advancing timers post-unmount causes no stray work or errors
    const drawsBefore = mockCanvasCtx.drawImage.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mockCanvasCtx.drawImage.mock.calls.length).toBe(drawsBefore);
  });

  it("skips the initial loader after a refresh in the same browser session", async () => {
    window.sessionStorage.setItem(LOADER_SEEN_KEY, "1");
    document.body.style.overflow = "auto";

    render(<InitialLoader />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });

    expect(document.getElementById("initial-loader-overlay")).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
    expect(decodedSrcs.some((src) => src.includes(BACKFLIP_SHEET_SRC))).toBe(
      false
    );
    expect(findBackflipTweenCall()).toBeUndefined();
  });
});
