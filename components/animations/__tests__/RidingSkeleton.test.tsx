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
import TechMarquee from "@/components/TechMarquee";
import RidingSkeleton from "@/components/animations/RidingSkeleton";

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
  to: Mock<() => AnimationStub>;
  fromTo: Mock<
    (
      target: unknown,
      fromVars: TweenVarsRecord,
      toVars: TweenVarsRecord
    ) => AnimationStub
  >;
  set: Mock<(target: unknown, vars: TweenVarsRecord) => AnimationStub>;
  eventCallback: Mock<() => AnimationStub>;
}

interface RecordedFromToCall {
  target: unknown;
  fromVars: TweenVarsRecord;
  toVars: TweenVarsRecord;
  tween: AnimationStub;
}

interface RecordedSetCall {
  target: unknown;
  vars: TweenVarsRecord;
}

const gsapMockState = vi.hoisted(() => {
  const fromToCalls: RecordedFromToCall[] = [];
  const setCalls: RecordedSetCall[] = [];
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
      to: vi.fn(() => stub),
      fromTo: vi.fn(
        (target: unknown, fromVars: TweenVarsRecord, toVars: TweenVarsRecord) => {
          const child = createAnimationStub(
            Boolean(toVars?.paused ?? fromVars?.paused ?? isPaused)
          );
          fromToCalls.push({ target, fromVars, toVars, tween: child });
          return stub;
        }
      ),
      set: vi.fn((target: unknown, vars: TweenVarsRecord) => {
        setCalls.push({ target, vars });
        return stub;
      }),
      eventCallback: vi.fn(() => stub),
    };

    return stub;
  };

  interface MockGsapContext {
    conditions: Record<string, boolean>;
    isReverted: boolean;
    add: (fn: () => void) => void;
  }

  const matchMediaMock = vi.fn(() => {
    const cleanups: Array<() => void> = [];
    const activeContexts: MockGsapContext[] = [];

    const mm = {
      contexts: activeContexts as unknown[],
      add: vi.fn(
        (
          conditions: string | Record<string, string>,
          func: (context: MockGsapContext) => void | (() => void)
        ) => {
          let matches = false;
          const resolved: Record<string, boolean> = {};

          if (typeof conditions === "string") {
            matches = Boolean(window.matchMedia?.(conditions)?.matches);
          } else if (conditions && typeof conditions === "object") {
            for (const [key, query] of Object.entries(conditions)) {
              resolved[key] = Boolean(window.matchMedia?.(query)?.matches);
            }
            matches = Object.values(resolved).some(Boolean);
          }

          if (matches) {
            const ctx: MockGsapContext = {
              conditions: resolved,
              isReverted: false,
              add: (fn: () => void) => fn(),
            };
            activeContexts.push(ctx);
            const cleanup = func(ctx);
            if (typeof cleanup === "function") {
              cleanups.push(cleanup);
            }
          }

          return mm;
        }
      ),
      revert: vi.fn(() => {
        for (const ctx of activeContexts) {
          ctx.isReverted = true;
        }
        while (cleanups.length > 0) {
          const cleanup = cleanups.pop();
          cleanup?.();
        }
        revertSpy();
      }),
      kill: vi.fn(() => {
        for (const ctx of activeContexts) {
          ctx.isReverted = true;
        }
        cleanups.length = 0;
      }),
    };

    return mm;
  });

  const contextMock = vi.fn(
    (func?: (context: MockGsapContext) => void | (() => void)) => {
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
    set: vi.fn((target: unknown, vars: TweenVarsRecord) => {
      setCalls.push({ target, vars });
      return createAnimationStub();
    }),
    to: vi.fn((_target: unknown, vars?: TweenVarsRecord) =>
      createAnimationStub(Boolean(vars?.paused))
    ),
    fromTo: vi.fn(
      (target: unknown, fromVars: TweenVarsRecord, toVars: TweenVarsRecord) => {
        const tween = createAnimationStub(
          Boolean(toVars?.paused ?? fromVars?.paused)
        );
        fromToCalls.push({ target, fromVars, toVars, tween });
        return tween;
      }
    ),
    timeline: vi.fn((vars?: TweenVarsRecord) =>
      createAnimationStub(Boolean(vars?.paused))
    ),
    delayedCall: vi.fn((delay: number, fn: () => void) => {
      let killed = false;
      const stub = createAnimationStub();
      stub.kill = vi.fn(() => {
        killed = true;
        return stub;
      });
      if (delay <= 0) {
        queueMicrotask(() => {
          if (!killed) fn();
        });
      } else {
        setTimeout(() => {
          if (!killed) fn();
        }, delay * 1000);
      }
      return stub;
    }),
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      fps: vi.fn(),
      lagSmoothing: vi.fn(),
    },
    killTweensOf: vi.fn(),
    matchMedia: matchMediaMock,
    context: contextMock,
  };

  const reset = () => {
    fromToCalls.length = 0;
    setCalls.length = 0;
    revertSpy.mockClear();
    gsapMock.set.mockClear();
    gsapMock.to.mockClear();
    gsapMock.fromTo.mockClear();
    gsapMock.timeline.mockClear();
    gsapMock.delayedCall.mockClear();
    gsapMock.ticker.add.mockClear();
    gsapMock.ticker.remove.mockClear();
    gsapMock.killTweensOf.mockClear();
    matchMediaMock.mockClear();
    contextMock.mockClear();
  };

  return {
    fromToCalls,
    setCalls,
    revertSpy,
    gsapMock,
    reset,
  };
});

vi.mock("gsap", () => ({
  default: gsapMockState.gsapMock,
  gsap: gsapMockState.gsapMock,
}));

const LANE_WIDTH = 1200;
const LANE_HEIGHT = 80;
const RIDER_WIDTH = 120;
const RIDER_HEIGHT = 72;

interface MockIntersectionObserverRecord {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
  disconnected: boolean;
  observe: Mock<(target: Element) => void>;
  unobserve: Mock<(target: Element) => void>;
  disconnect: Mock<() => void>;
}

interface MockResizeObserverRecord {
  targets: Set<Element>;
  disconnected: boolean;
  observe: Mock<(target: Element) => void>;
  unobserve: Mock<(target: Element) => void>;
  disconnect: Mock<() => void>;
}

interface MockMutationObserverRecord {
  observe: Mock<(target: Node, options?: MutationObserverInit) => void>;
  disconnect: Mock<() => void>;
  takeRecords: Mock<() => MutationRecord[]>;
}

function createMatchMediaMock(reducedMotion: boolean) {
  return vi.fn((query: string): MediaQueryList => {
    let matches = false;
    if (query.includes("prefers-reduced-motion: reduce")) {
      matches = reducedMotion;
    } else if (query.includes("prefers-reduced-motion: no-preference")) {
      matches = !reducedMotion;
    } else {
      const minMatch = query.match(/min-width:\s*(\d+)px/);
      const maxMatch = query.match(/max-width:\s*(\d+)px/);
      if (minMatch || maxMatch) {
        const minOk = minMatch ? window.innerWidth >= Number(minMatch[1]) : true;
        const maxOk = maxMatch ? window.innerWidth <= Number(maxMatch[1]) : true;
        matches = minOk && maxOk;
      }
    }

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    };
  });
}

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

describe("RidingSkeleton & TechMarquee", () => {
  const OriginalIntersectionObserver = globalThis.IntersectionObserver;
  const OriginalResizeObserver = globalThis.ResizeObserver;
  const OriginalMutationObserver = globalThis.MutationObserver;
  const OriginalMatchMedia = window.matchMedia;
  const OriginalInnerWidth = window.innerWidth;
  const OriginalDecode = HTMLImageElement.prototype.decode;
  const OriginalGetContext = HTMLCanvasElement.prototype.getContext;
  const OriginalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;
  const OriginalClientWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth"
  );
  const OriginalOffsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth"
  );
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

  let intersectionObservers: MockIntersectionObserverRecord[] = [];
  let resizeObservers: MockResizeObserverRecord[] = [];
  let mutationObservers: MockMutationObserverRecord[] = [];
  let decodedSrcs: string[] = [];
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
    fillRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    closePath: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    globalAlpha: number;
    imageSmoothingEnabled: boolean;
    imageSmoothingQuality: ImageSmoothingQuality;
  };

  function emitIntersection(isIntersecting: boolean) {
    act(() => {
      for (const observer of intersectionObservers) {
        if (observer.disconnected || observer.targets.size === 0) continue;
        const entries = Array.from(observer.targets).map(
          (target) =>
            ({
              isIntersecting,
              intersectionRatio: isIntersecting ? 1 : 0,
              target,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: isIntersecting
                ? target.getBoundingClientRect()
                : makeDomRect(0, 0),
              rootBounds: null,
              time: performance.now(),
            }) as IntersectionObserverEntry
        );
        observer.callback(entries, observer as unknown as IntersectionObserver);
      }
    });
  }

  function findHorizontalTweenCall(): RecordedFromToCall | undefined {
    return gsapMockState.fromToCalls.find((call) => {
      const hasX =
        call.fromVars &&
        "x" in call.fromVars &&
        call.toVars &&
        "x" in call.toVars;
      return hasX && call.toVars.repeat === -1;
    });
  }

  beforeEach(() => {
    gsapMockState.reset();
    intersectionObservers = [];
    resizeObservers = [];
    mutationObservers = [];
    decodedSrcs = [];

    document.getElementById("initial-loader-overlay")?.remove();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: LANE_WIDTH,
    });

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

    window.matchMedia = createMatchMediaMock(false);

    HTMLElement.prototype.getBoundingClientRect = function () {
      const testId = this.getAttribute("data-testid");
      if (testId === "riding-skeleton-lane") {
        return makeDomRect(LANE_WIDTH, LANE_HEIGHT);
      }
      if (testId === "riding-skeleton-canvas") {
        return makeDomRect(RIDER_WIDTH, RIDER_HEIGHT);
      }
      return makeDomRect(0, 0);
    };

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        const testId = (this as HTMLElement).getAttribute("data-testid");
        if (testId === "riding-skeleton-lane") return LANE_WIDTH;
        if (testId === "riding-skeleton-canvas") return RIDER_WIDTH;
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        const testId = (this as HTMLElement).getAttribute("data-testid");
        if (testId === "riding-skeleton-lane") return LANE_WIDTH;
        if (testId === "riding-skeleton-canvas") return RIDER_WIDTH;
        return 0;
      },
    });

    decodeSpy = vi.fn(function (this: HTMLImageElement) {
      decodedSrcs.push(this.getAttribute("src") ?? this.src ?? "");
      return Promise.resolve();
    });
    HTMLImageElement.prototype.decode = decodeSpy;

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return (this as HTMLImageElement).getAttribute("src") ? 1920 : 0;
      },
    });

    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        return (this as HTMLImageElement).getAttribute("src") ? 1080 : 0;
      },
    });

    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return Boolean((this as HTMLImageElement).getAttribute("src"));
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
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      globalAlpha: 1,
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

    globalThis.IntersectionObserver = class MockIntersectionObserver
      implements IntersectionObserver
    {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      private readonly record: MockIntersectionObserverRecord;

      constructor(callback: IntersectionObserverCallback) {
        const targets = new Set<Element>();
        const record: MockIntersectionObserverRecord = {
          callback,
          targets,
          disconnected: false,
          observe: vi.fn((target: Element) => {
            targets.add(target);
          }),
          unobserve: vi.fn((target: Element) => {
            targets.delete(target);
          }),
          disconnect: vi.fn(() => {
            record.disconnected = true;
            targets.clear();
          }),
        };
        this.record = record;
        intersectionObservers.push(record);
      }

      observe = (target: Element) => this.record.observe(target);
      unobserve = (target: Element) => this.record.unobserve(target);
      disconnect = () => this.record.disconnect();
      takeRecords = (): IntersectionObserverEntry[] => [];
    };

    globalThis.ResizeObserver = class MockResizeObserver
      implements ResizeObserver
    {
      private readonly record: MockResizeObserverRecord;

      constructor(callback: ResizeObserverCallback) {
        const targets = new Set<Element>();
        const record: MockResizeObserverRecord = {
          targets,
          disconnected: false,
          observe: vi.fn((target: Element) => {
            targets.add(target);
            queueMicrotask(() => {
              if (record.disconnected || !targets.has(target)) return;
              callback(
                [
                  {
                    target,
                    contentRect: target.getBoundingClientRect(),
                    borderBoxSize: [],
                    contentBoxSize: [],
                    devicePixelContentBoxSize: [],
                  } as unknown as ResizeObserverEntry,
                ],
                this
              );
            });
          }),
          unobserve: vi.fn((target: Element) => {
            targets.delete(target);
          }),
          disconnect: vi.fn(() => {
            record.disconnected = true;
            targets.clear();
          }),
        };
        this.record = record;
        resizeObservers.push(record);
      }

      observe = (target: Element) => this.record.observe(target);
      unobserve = (target: Element) => this.record.unobserve(target);
      disconnect = () => this.record.disconnect();
    };

        globalThis.MutationObserver = class MockMutationObserver
      implements MutationObserver
    {
      private readonly real: MutationObserver;
      readonly observe: Mock<
        (target: Node, options?: MutationObserverInit) => void
      >;
      readonly disconnect: Mock<() => void>;
      readonly takeRecords: Mock<() => MutationRecord[]>;

      constructor(callback: MutationCallback) {
        this.real = new OriginalMutationObserver(callback);
        this.observe = vi.fn(
          (target: Node, options?: MutationObserverInit) => {
            this.real.observe(target, options);
          }
        );
        this.disconnect = vi.fn(() => {
          this.real.disconnect();
        });
        this.takeRecords = vi.fn(() => this.real.takeRecords());

        mutationObservers.push({
          observe: this.observe,
          disconnect: this.disconnect,
          takeRecords: this.takeRecords,
        });
      }
    } as unknown as typeof MutationObserver;
  });

  afterEach(() => {
    document.getElementById("initial-loader-overlay")?.remove();
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
    globalThis.ResizeObserver = OriginalResizeObserver;
    globalThis.MutationObserver = OriginalMutationObserver;
    window.matchMedia = OriginalMatchMedia;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: OriginalInnerWidth,
    });
    HTMLImageElement.prototype.decode = OriginalDecode;
    HTMLCanvasElement.prototype.getContext = OriginalGetContext;
    HTMLElement.prototype.getBoundingClientRect = OriginalGetBoundingClientRect;

    if (OriginalClientWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientWidth",
        OriginalClientWidth
      );
    }
    if (OriginalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetWidth",
        OriginalOffsetWidth
      );
    }
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

  it("renders TechMarquee icons inside .animate-marquee and embeds RidingSkeleton in an aria-hidden overflow-x-clip wrapper", () => {
    const { container } = render(<TechMarquee />);

    const outerWrapper = container.firstElementChild as HTMLElement | null;
    expect(outerWrapper).not.toBeNull();
    expect(outerWrapper).toHaveAttribute("aria-hidden", "true");
    expect(outerWrapper?.className).toContain("overflow-x-clip");

    const marqueeContainer = outerWrapper?.querySelector(".animate-marquee");
    expect(marqueeContainer).not.toBeNull();

    const svgs = marqueeContainer?.querySelectorAll("svg") ?? [];
    // Tech icons remain duplicated cleanly in the marquee track
    expect(svgs.length).toBeGreaterThanOrEqual(26);
    expect(svgs.length % 13).toBe(0);
    // AuthJsIcon custom SVG remains present
    expect(
      marqueeContainer?.querySelector('svg[viewBox="0 0 210 232"]')
    ).not.toBeNull();

    const lane = screen.getByTestId("riding-skeleton-lane");
    expect(outerWrapper?.contains(lane)).toBe(true);
  });

  it("animates the rider left-to-right when direction is right", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 200 });
    render(<RidingSkeleton direction="right" />);
    emitIntersection(true);

    await waitFor(() => {
      expect(
        decodedSrcs.some((src) => src.includes("skeleton-riding-sheet"))
      ).toBe(true);
    });

    await waitFor(() => {
      expect(findHorizontalTweenCall()).toBeDefined();
    });

    const horizontalCall = findHorizontalTweenCall();
    expect(Number(horizontalCall?.fromVars.x)).toBeLessThan(0);
    expect(Number(horizontalCall?.toVars.x)).toBeGreaterThan(0);
    expect(Number(horizontalCall?.fromVars.scaleX)).toBe(-1);
    expect(Number(horizontalCall?.toVars.scaleX)).toBe(-1);
  });

  it("continues animating canvas and running GSAP horizontal loop even when prefers-reduced-motion is reduce", async () => {
    window.matchMedia = createMatchMediaMock(true);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 200 });

    render(<RidingSkeleton />);
    emitIntersection(true);

    await waitFor(() => {
      expect(
        decodedSrcs.some((src) => src.includes("skeleton-riding-sheet"))
      ).toBe(true);
    });

    expect(screen.getByTestId("riding-skeleton-canvas")).toBeInTheDocument();
    expect(screen.queryByTestId("riding-skeleton-poster")).toBeNull();

    await waitFor(() => {
      expect(findHorizontalTweenCall()).toBeDefined();
    });
  });

  it("renders static poster and skips sprite decode and horizontal GSAP loop when navigator.connection.saveData is true", () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      writable: true,
      value: { saveData: true },
    });

    render(<RidingSkeleton />);
    emitIntersection(true);

    expect(screen.getByTestId("riding-skeleton-poster")).toBeInTheDocument();
    expect(screen.queryByTestId("riding-skeleton-canvas")).toBeNull();
    expect(findHorizontalTweenCall()).toBeUndefined();
    expect(
      decodedSrcs.some((src) => src.includes("skeleton-riding-sheet"))
    ).toBe(false);
  });

  it("waits for #initial-loader-overlay removal and intersection, decodes sprite, draws frame 0, and runs GSAP fromTo from trackWidth to -riderWidth with repeat -1", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 200 });
    const loaderOverlay = document.createElement("div");
    loaderOverlay.id = "initial-loader-overlay";
    document.body.appendChild(loaderOverlay);

    render(<RidingSkeleton />);

    // Intersecting while initial loader overlay is still mounted must stay gated
    emitIntersection(true);
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      decodedSrcs.some((src) => src.includes("skeleton-riding-sheet"))
    ).toBe(false);
    expect(findHorizontalTweenCall()).toBeUndefined();

    // Remove loader overlay -> MutationObserver unblocks sprite decode + canvas draw + GSAP loop
    await act(async () => {
      loaderOverlay.remove();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        decodedSrcs.some((src) => src.includes("skeleton-riding-sheet"))
      ).toBe(true);
    });

    const canvas = screen.getByTestId("riding-skeleton-canvas");
    expect(canvas).toBeInTheDocument();

    await waitFor(() => {
      expect(mockCanvasCtx.drawImage).toHaveBeenCalled();
    });

    // Verify frame 0 (first sprite cell with 4px gutter) is drawn on canvas
    const firstDrawArgs = mockCanvasCtx.drawImage.mock.calls[0];
    if (firstDrawArgs && firstDrawArgs.length >= 9) {
      expect(firstDrawArgs[1]).toBe(4);
      expect(firstDrawArgs[2]).toBe(4);
      expect(firstDrawArgs[3]).toBe(300);
      expect(firstDrawArgs[4]).toBe(286);
    }

    await waitFor(() => {
      expect(findHorizontalTweenCall()).toBeDefined();
    });

    const horizontalCall = findHorizontalTweenCall();
    expect(horizontalCall).toBeDefined();
    const fromX = Number(horizontalCall?.fromVars.x);
    const toX = Number(horizontalCall?.toVars.x);

    expect(fromX).toBeGreaterThan(0);
    expect(toX).toBeLessThan(0);
    expect(horizontalCall?.toVars.repeat).toBe(-1);
  });

  it("pauses active tween on visibilitychange when hidden, resumes when visible, and disconnects observers + calls revert on unmount", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 200 });
    const loaderOverlay = document.createElement("div");
    loaderOverlay.id = "initial-loader-overlay";
    document.body.appendChild(loaderOverlay);

    const { unmount } = render(<RidingSkeleton />);

    emitIntersection(true);
    await act(async () => {
      loaderOverlay.remove();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(findHorizontalTweenCall()).toBeDefined();
    });

    const horizontalCall = findHorizontalTweenCall()!;
    const activeTween = horizontalCall.tween;

    // Hide document -> tween pauses
    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        writable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(activeTween.paused()).toBe(true);

    // Show document again -> tween resumes
    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        writable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(activeTween.paused()).toBe(false);

    // Clean unmount disconnects all created observers and reverts GSAP context/matchMedia
    expect(() => unmount()).not.toThrow();

    for (const observer of intersectionObservers) {
      expect(observer.disconnect).toHaveBeenCalled();
    }
    for (const observer of resizeObservers) {
      expect(observer.disconnect).toHaveBeenCalled();
    }
    for (const observer of mutationObservers) {
      expect(observer.disconnect).toHaveBeenCalled();
    }
    expect(gsapMockState.revertSpy).toHaveBeenCalled();
  });

  it("retries failed sprite decodes and falls back to static poster when retries exhaust", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 200 });
    vi.useFakeTimers();
    try {
      HTMLImageElement.prototype.decode = vi.fn(function (
        this: HTMLImageElement
      ) {
        decodedSrcs.push(this.getAttribute("src") ?? this.src ?? "");
        return Promise.reject(new Error("Transient network failure"));
      });

      render(<RidingSkeleton />);
      emitIntersection(true);

      await act(async () => {
        await Promise.resolve();
      });

      const sheetAttempts = () =>
        decodedSrcs.filter((src) => src.includes("skeleton-riding-sheet"));

      expect(sheetAttempts()).toHaveLength(1);

      // Advance past first retry (1000ms) -> 2nd attempt
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(sheetAttempts()).toHaveLength(2);

      // Advance past second retry (3000ms) -> 3rd attempt -> falls back to static poster
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(sheetAttempts()).toHaveLength(3);
      expect(screen.getByTestId("riding-skeleton-poster")).toBeInTheDocument();
      expect(screen.queryByTestId("riding-skeleton-canvas")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
