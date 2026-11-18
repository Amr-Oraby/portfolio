import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import HeroContent from "@/app/features/hero/HeroContent";
import TypingSkeleton, {
  TYPING_POSTER_SRC,
  TYPING_SHEET_SRC,
} from "@/components/animations/TypingSkeleton";

type TweenVarsRecord = Record<string, unknown>;

interface AnimationStub {
  pause: Mock<() => AnimationStub>;
  play: Mock<() => AnimationStub>;
  kill: Mock<() => AnimationStub>;
  revert: Mock<() => AnimationStub>;
  paused: Mock<(value?: boolean) => boolean | AnimationStub>;
  to: Mock<() => AnimationStub>;
  set: Mock<() => AnimationStub>;
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
      to: vi.fn(() => stub),
      set: vi.fn(() => stub),
    };

    return stub;
  };

  const contextMock = vi.fn(
    (func?: (context: { isReverted: boolean }) => void | (() => void)) => {
      const cleanups: Array<() => void> = [];
      const ctx = { isReverted: false };
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
            cleanups.pop()?.();
          }
          revertSpy();
        }),
        kill: vi.fn(() => {
          ctx.isReverted = true;
          cleanups.length = 0;
        }),
      };
    }
  );

  const gsapMock = {
    to: vi.fn((target: unknown, vars: TweenVarsRecord) => {
      const tween = createAnimationStub(Boolean(vars?.paused));
      toCalls.push({ target, vars, tween });
      return tween;
    }),
    context: contextMock,
  };

  return { toCalls, revertSpy, gsapMock };
});

vi.mock("gsap", () => ({
  default: gsapMockState.gsapMock,
  ...gsapMockState.gsapMock,
}));

vi.mock("@/public/fonts/Fraunces", () => ({
  fraunces: { className: "fraunces-mock" },
}));

interface MockCtx2D {
  clearRect: Mock<(...args: number[]) => void>;
  drawImage: Mock<(...args: unknown[]) => void>;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
}

describe("TypingSkeleton & HeroContent integration", () => {
  let mockCtx: MockCtx2D;
  let ioInstances: Array<{
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    disconnect: Mock;
    elements: Element[];
  }>;
  let moInstances: Array<{
    callback: MutationCallback;
    disconnect: Mock;
  }>;
  let decodeShouldReject = false;
  let decodeDeferred: {
    resolve: () => void;
    reject: (err?: Error) => void;
  } | null = null;
  let deferDecode = false;
  let requestedSheetUrls: string[] = [];
  let hiddenValue = false;
  let saveDataValue = false;
  let reducedMotionValue = false;
  let origDecode: PropertyDescriptor | undefined;
  let origNaturalWidth: PropertyDescriptor | undefined;
  let origNaturalHeight: PropertyDescriptor | undefined;
  let origGetContext: PropertyDescriptor | undefined;
  let origConnection: PropertyDescriptor | undefined;
  let origHidden: PropertyDescriptor | undefined;

  beforeEach(() => {
    gsapMockState.toCalls.length = 0;
    gsapMockState.revertSpy.mockClear();
    gsapMockState.gsapMock.to.mockClear();
    gsapMockState.gsapMock.context.mockClear();

    decodeShouldReject = false;
    deferDecode = false;
    decodeDeferred = null;
    requestedSheetUrls = [];
    hiddenValue = false;
    saveDataValue = false;
    reducedMotionValue = false;
    ioInstances = [];
    moInstances = [];
    delete document.documentElement.dataset.loaderSeen;

    mockCtx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
    };

    origGetContext = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "getContext"
    );
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => mockCtx),
    });

    origDecode = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "decode"
    );
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn(function (this: HTMLImageElement) {
        const src = this.getAttribute("src") ?? this.src ?? "";
        if (src.includes(TYPING_SHEET_SRC)) {
          requestedSheetUrls.push(src);
        }
        if (deferDecode && src.includes(TYPING_SHEET_SRC)) {
          return new Promise<void>((resolve, reject) => {
            decodeDeferred = {
              resolve: () => resolve(),
              reject: (err) => reject(err ?? new Error("decode failed")),
            };
          });
        }
        if (decodeShouldReject && src.includes(TYPING_SHEET_SRC)) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve();
      }),
    });

    origNaturalWidth = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalWidth"
    );
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 1824;
      },
    });

    origNaturalHeight = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalHeight"
    );
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        return 1974;
      },
    });

    origConnection = Object.getOwnPropertyDescriptor(navigator, "connection");
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get() {
        return {
          saveData: saveDataValue,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      },
    });

    origHidden = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get() {
        return hiddenValue;
      },
    });

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches:
          query.includes("prefers-reduced-motion") && reducedMotionValue,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        options?: IntersectionObserverInit;
        disconnect = vi.fn();
        elements: Element[] = [];
        constructor(
          cb: IntersectionObserverCallback,
          opts?: IntersectionObserverInit
        ) {
          this.callback = cb;
          this.options = opts;
          ioInstances.push({
            callback: cb,
            options: opts,
            disconnect: this.disconnect,
            elements: this.elements,
          });
        }
        observe(el: Element) {
          this.elements.push(el);
        }
        unobserve() {}
        takeRecords() {
          return [];
        }
      }
    );

    vi.stubGlobal(
      "MutationObserver",
      class {
        callback: MutationCallback;
        disconnect = vi.fn();
        constructor(cb: MutationCallback) {
          this.callback = cb;
          moInstances.push({ callback: cb, disconnect: this.disconnect });
        }
        observe() {}
        takeRecords() {
          return [];
        }
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (origGetContext) {
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        "getContext",
        origGetContext
      );
    }
    if (origDecode) {
      Object.defineProperty(HTMLImageElement.prototype, "decode", origDecode);
    }
    if (origNaturalWidth) {
      Object.defineProperty(
        HTMLImageElement.prototype,
        "naturalWidth",
        origNaturalWidth
      );
    }
    if (origNaturalHeight) {
      Object.defineProperty(
        HTMLImageElement.prototype,
        "naturalHeight",
        origNaturalHeight
      );
    }
    if (origConnection) {
      Object.defineProperty(navigator, "connection", origConnection);
    }
    if (origHidden) {
      Object.defineProperty(document, "hidden", origHidden);
    }
    document.getElementById("initial-loader-overlay")?.remove();
    delete document.documentElement.dataset.loaderSeen;
  });

  const triggerIO = (index: number, isIntersecting: boolean) => {
    const inst = ioInstances[index];
    if (!inst) return;
    act(() => {
      inst.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        inst as unknown as IntersectionObserver
      );
    });
  };

  it("replaces portrait in HeroContent without background box, borders, or Fig. 001 caption", () => {
    render(<HeroContent />);

    expect(screen.getByText("Building")).toBeInTheDocument();
    expect(screen.getByText("digital")).toBeInTheDocument();
    expect(screen.getByText("experiences.")).toBeInTheDocument();
    expect(screen.queryByText("Fig. 001")).toBeNull();
    expect(screen.queryByText("Portrait")).toBeNull();

    expect(screen.getByTestId("hero-typing-stage")).toBeInTheDocument();
    expect(screen.getByTestId("hero-typing-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("hero-typing-poster")).toHaveAttribute(
      "src",
      TYPING_POSTER_SRC
    );
    expect(document.querySelector('img[src*="portrait.png"]')).toBeNull();
  });

  it("renders only static poster and skips sheet load when saveData is enabled", () => {
    saveDataValue = true;
    render(<TypingSkeleton />);

    expect(screen.getByTestId("hero-typing-poster")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-typing-canvas")).toBeNull();
    expect(requestedSheetUrls).toEqual([]);
  });

  it("waits for #initial-loader-overlay dismissal, draws frame 0 cleanly, hides poster, and loops infinitely", async () => {
    const overlay = document.createElement("div");
    overlay.id = "initial-loader-overlay";
    document.body.appendChild(overlay);

    render(<TypingSkeleton />);

    // Enter both preloadZone & viewport visibility while loader is still up
    triggerIO(0, true);
    triggerIO(1, true);
    expect(requestedSheetUrls).toEqual([]);

    // Remove loader overlay & fire MutationObserver
    overlay.remove();
    act(() => {
      moInstances[0]?.callback([], moInstances[0] as unknown as MutationObserver);
    });

    await waitFor(() => {
      expect(requestedSheetUrls.length).toBe(1);
    });

    await waitFor(() => {
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.anything(),
        4,
        4,
        220,
        274,
        0,
        0,
        220,
        274
      );
    });

    const posterWrapper = screen.getByTestId("hero-typing-poster").parentElement;
    expect(posterWrapper?.style.display).toBe("none");

    expect(gsapMockState.toCalls.length).toBe(1);
    const call = gsapMockState.toCalls[0];
    expect(call.vars.frame).toBe(55);
    expect(call.vars.duration).toBeCloseTo(55 / 24, 4);
    expect(call.vars.repeat).toBe(-1);
    expect(call.vars.ease).toBe("none");
    expect(call.tween.paused()).toBe(false);

    // Advance playhead across several frames without redundant draws for same index
    mockCtx.drawImage.mockClear();
    const target = call.target as { frame: number };
    const onUpdate = call.vars.onUpdate as () => void;
    act(() => {
      target.frame = 0.4;
      onUpdate();
      target.frame = 1.2;
      onUpdate();
      target.frame = 1.8;
      onUpdate();
      target.frame = 54.9;
      onUpdate();
    });
    // Frame 0 already drawn; frames 1 and 54 each drawn once
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);
  });

  it("keeps typing animation running when prefers-reduced-motion: reduce is set (D2)", async () => {
    reducedMotionValue = true;
    document.documentElement.dataset.loaderSeen = "1";

    render(<TypingSkeleton />);
    triggerIO(0, true);
    triggerIO(1, true);

    await waitFor(() => {
      expect(gsapMockState.toCalls.length).toBe(1);
    });
    expect(gsapMockState.toCalls[0].tween.paused()).toBe(false);
  });

  it("starts immediately on repeat visits via dataset.loaderSeen even if hidden SSR overlay exists", async () => {
    document.documentElement.dataset.loaderSeen = "1";
    const hiddenOverlay = document.createElement("div");
    hiddenOverlay.id = "initial-loader-overlay";
    document.body.appendChild(hiddenOverlay);

    render(<TypingSkeleton />);
    triggerIO(0, true);
    triggerIO(1, true);

    await waitFor(() => {
      expect(requestedSheetUrls.length).toBe(1);
    });
  });

  it("pauses on off-screen IntersectionObserver and document visibilitychange, and resumes cleanly", async () => {
    document.documentElement.dataset.loaderSeen = "1";
    render(<TypingSkeleton />);

    triggerIO(0, true);
    triggerIO(1, true);

    await waitFor(() => {
      expect(gsapMockState.toCalls.length).toBe(1);
    });
    const tween = gsapMockState.toCalls[0].tween;
    expect(tween.paused()).toBe(false);

    triggerIO(1, false);
    expect(tween.pause).toHaveBeenCalled();
    expect(tween.paused()).toBe(true);

    triggerIO(1, true);
    expect(tween.play).toHaveBeenCalled();
    expect(tween.paused()).toBe(false);

    hiddenValue = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(tween.paused()).toBe(true);

    hiddenValue = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(tween.paused()).toBe(false);
  });

  it("retries failed sprite loads with backoff and keeps static poster on exhaustion", async () => {
    vi.useFakeTimers();
    decodeShouldReject = true;
    document.documentElement.dataset.loaderSeen = "1";

    render(<TypingSkeleton />);
    triggerIO(0, true);
    triggerIO(1, true);

    // Flush rAF + initial rejected decode
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(requestedSheetUrls.length).toBe(1);

    // Retry 1 after 1000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(requestedSheetUrls.length).toBe(2);

    // Retry 2 after 3000ms -> fallback to static poster
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(requestedSheetUrls.length).toBe(3);

    expect(screen.getByTestId("hero-typing-poster")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-typing-canvas")).toBeNull();
  });

  it("cleans up observers, pending decode, canvas buffer, and reverts GSAP on unmount", async () => {
    deferDecode = true;
    document.documentElement.dataset.loaderSeen = "1";

    const { unmount } = render(<TypingSkeleton />);
    triggerIO(0, true);
    triggerIO(1, true);

    await waitFor(() => {
      expect(decodeDeferred).not.toBeNull();
    });

    const canvas = screen.getByTestId(
      "hero-typing-canvas"
    ) as HTMLCanvasElement;

    act(() => {
      decodeDeferred?.resolve();
    });

    await waitFor(() => {
      expect(gsapMockState.toCalls.length).toBe(1);
    });

    unmount();

    expect(gsapMockState.revertSpy).toHaveBeenCalled();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    for (const io of ioInstances) {
      expect(io.disconnect).toHaveBeenCalled();
    }
  });
});
