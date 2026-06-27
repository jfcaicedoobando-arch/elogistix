/**
 * F4 (audit Sentry 13.65.0): valida el helper centralizado `reportCaughtError`
 * — usa dynamic import del SDK para respetar el guardrail ESLint
 * `no-restricted-imports` y mantener `@sentry/react` fuera del bundle inicial.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react", () => mocks);

import { reportCaughtError } from "../reportCaughtError";

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => mocks.captureException.mockClear());
afterEach(() => vi.clearAllMocks());

describe("reportCaughtError", () => {
  it("reenvía el error a Sentry con tags { feature, op } y extra", async () => {
    const err = new Error("boom");
    reportCaughtError(err, { feature: "facturacion", op: "generar_zip_masivo" }, { total: 5 });
    await flush();
    expect(mocks.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: { feature: "facturacion", op: "generar_zip_masivo" },
        extra: { total: 5 },
      }),
    );
  });

  it("acepta sólo `feature` (op opcional) y sin extra", async () => {
    const err = new Error("only-feature");
    reportCaughtError(err, { feature: "tesoreria" });
    await flush();
    expect(mocks.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ tags: { feature: "tesoreria" }, extra: undefined }),
    );
  });

  it("no lanza si el import dinámico falla — best effort", async () => {
    // Forzar el mock a tirar — el helper debe tragarse el error sin propagar.
    mocks.captureException.mockImplementationOnce(() => {
      throw new Error("sdk-init-failed");
    });
    expect(() =>
      reportCaughtError(new Error("x"), { feature: "pnl" }),
    ).not.toThrow();
    await flush();
  });
});
