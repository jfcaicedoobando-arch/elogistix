/** Sentry JAVASCRIPT-REACT-82: un 429 de la IA es aviso pasajero, no error. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { reportMock } = vi.hoisted(() => ({ reportMock: vi.fn() }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: reportMock }));

import { buildFailure, type Attempt } from "../parsePdfInvoice.errors";

const pdf = new File(["%PDF"], "f.pdf", { type: "application/pdf" });
const intento = (status: number): Attempt => ({
  ok: false, phase: "response", status, message: "x", cause: null, retryable: true,
});

beforeEach(() => reportMock.mockReset());

describe("buildFailure", () => {
  it("429 se reporta como aviso con mensaje claro", () => {
    const err = buildFailure(pdf, intento(429), 10);
    expect(reportMock.mock.calls[0][3]).toBe("warning");
    expect(err.message).toContain("demasiadas solicitudes");
  });
  it("500 sigue siendo error", () => {
    buildFailure(pdf, intento(500), 10);
    expect(reportMock.mock.calls[0][3]).toBeUndefined();
  });
});
