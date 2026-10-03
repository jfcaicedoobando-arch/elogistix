import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import { captureExceptionOnce } from "../../captureExceptionOnce";
import { loadInitializedSentry } from "../runtime";
import { ensureEventId, openReportFeedback } from "@/components/shared/errorBoundary/reportFeedback";

// Use the real SDK, never the real DSN or transport. Stub only the app bootstrap.
const bootstrap = vi.hoisted(() => ({ init: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: bootstrap.notifyError, notifySuccess: vi.fn() }));
vi.mock("../core", () => ({
  initSentry: bootstrap.init,
  isSentryReady: () => Sentry.isEnabled(),
}));

beforeEach(() => { vi.clearAllMocks(); bootstrap.init.mockReset(); Sentry.getCurrentScope().setClient(undefined); });
afterEach(async () => { await Sentry.close(1000); Sentry.getCurrentScope().setClient(undefined); });

function initialize(enabled = true) {
  Sentry.init({
    dsn: "https://mock@mock.invalid/1", enabled, defaultIntegrations: false,
    transport: () => ({ send: () => Promise.resolve({ statusCode: 200 }), flush: () => Promise.resolve(true) }),
  });
}

describe("Readiness barrier uses the actual SDK state", () => {
  it("no client: capture returns no ID, and a later bootstrap can succeed", async () => {
    expect(await loadInitializedSentry()).toBeNull();
    expect(await captureExceptionOnce(new Error("mock inactive failure"), {})).toBeUndefined();
    bootstrap.init.mockImplementationOnce(() => initialize());
    expect(await loadInitializedSentry()).toBe(Sentry);
    expect(await captureExceptionOnce(new Error("mock active failure"), {})).toMatch(/^[0-9a-f]{32}$/);
  });

  it("disabled clients are not mistaken for active transports", async () => {
    initialize(false);
    expect(Sentry.getClient()).toBeDefined();
    expect(await loadInitializedSentry()).toBeNull();
    expect(await captureExceptionOnce(new Error("mock disabled failure"), {})).toBeUndefined();
  });

  it("a cached SDK stops being available after close", async () => {
    initialize();
    expect(await loadInitializedSentry()).toBe(Sentry);
    await Sentry.close(1000);
    expect(await loadInitializedSentry()).toBeNull();
    expect(await captureExceptionOnce(new Error("mock closed failure"), {})).toBeUndefined();
  });

  it("initialization failure is contained and retryable", async () => {
    bootstrap.init.mockImplementationOnce(() => { throw new Error("mock bootstrap failure"); });
    expect(await loadInitializedSentry()).toBeNull();
    bootstrap.init.mockImplementationOnce(() => initialize());
    expect(await loadInitializedSentry()).toBe(Sentry);
  });

  it("manual feedback without a client keeps copy-details fallback and invents no ID", async () => {
    const snap = { error: new Error("mock crash"), eventId: null, componentStack: null, timestamp: null };
    const onEventId = vi.fn();
    expect(ensureEventId(snap, Sentry)).toBeNull();
    await openReportFeedback(snap, onEventId);
    expect(onEventId).not.toHaveBeenCalled();
    expect(bootstrap.notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      description: expect.stringContaining("Copiar detalles"),
    }));
  });

  it("enabled feedback reuses the crash ID rather than capturing another event", () => {
    initialize();
    expect(ensureEventId({ error: null, eventId: "mock-existing-id", componentStack: null, timestamp: null }, Sentry))
      .toBe("mock-existing-id");
  });
});
