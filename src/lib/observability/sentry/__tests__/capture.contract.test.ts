import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => string>(() => "mock-event-id"),
  initSentry: vi.fn(),
}));
vi.mock("@sentry/react", () => mocks);
vi.mock("../core", () => ({ initSentry: mocks.initSentry }));
vi.mock("@/lib/ui/appFeedback", async () => {
  const { reportCaughtError } = await import("../../reportCaughtError");
  return { notifyError: (_: unknown, options: { error: unknown }) =>
    reportCaughtError(options.error, { feature: "ui" }) };
});
import { reportCaughtError } from "../../reportCaughtError";
import { captureExceptionOnce } from "../../captureExceptionOnce";
import { queryClient } from "@/lib/query/queryClient";
import { computePostgrestFingerprint } from "../helpers";

beforeEach(() => { vi.clearAllMocks(); queryClient.clear(); });

describe("One event for a single failed operation", () => {
  it("actual QueryCache + UI notification share a plain PostgREST failure identity", async () => {
    const raw = { code: "42703", message: "column missing", details: "mock@example.invalid" };
    await expect(queryClient.fetchQuery({
      queryKey: ["facturas", { email: "mock@example.invalid" }], retry: false,
      queryFn: () => Promise.reject(raw),
    })).rejects.toBe(raw);
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1));
    const [error, context] = mocks.captureException.mock.calls[0] as unknown as [Error, { extra: unknown }];
    expect(computePostgrestFingerprint(error, "/facturacion/00000000-0000-0000-0000-000000000001"))
      .toEqual(["postgres", "42703", "/facturacion/:id"]);
    expect(JSON.stringify(context)).not.toContain("mock@example.invalid");
    expect(mocks.initSentry).toHaveBeenCalled();
  });

  it("native Error reported by two owners emits once, different failures remain distinct", async () => {
    const error = new Error("mock failure");
    reportCaughtError(error, { feature: "react" });
    await captureExceptionOnce(error, { tags: { source: "boundary" } });
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    await captureExceptionOnce(new Error("mock failure"), {});
    expect(mocks.captureException).toHaveBeenCalledTimes(2);
  });

  it.each(["23514", "23505", "P0001"])("unexpected %s isn't hidden by SQLSTATE", async (code) => {
    reportCaughtError({ code, message: "LC_UNKNOWN_REGRESSION" }, { feature: "mock" });
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1));
  });

  it("recovered chunks are silent, exhausted chunk recovery is reportable", async () => {
    await captureExceptionOnce(Object.assign(new Error("ChunkLoadError"), { expected: true }), {});
    expect(mocks.captureException).not.toHaveBeenCalled();
    await captureExceptionOnce(new Error("ChunkLoadError"), {});
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
  it("expected=false survives normalization of known-domain messages", async () => {
    reportCaughtError({ code: "P0001", expected: false, message: "LC_TRANSICION_INVALIDA regression" },
      { feature: "mock" });
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1));
    expect(mocks.captureException.mock.calls[0][0]).toMatchObject({ expected: false, code: "P0001" });
  });
  it("explicit unexpected intent on a wrapped cause isn't hidden by its known message", async () => {
    const error = new Error("LC_TRANSICION_INVALIDA regression", { cause: { expected: false } });
    reportCaughtError(error, { feature: "mock" });
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1));
  });
});
