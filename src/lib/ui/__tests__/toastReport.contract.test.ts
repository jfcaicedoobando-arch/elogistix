// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyError, notifyWarning, notifyInfo, dismissAllToasts } from "../appFeedback";
import { buildErrorReport, formatReportJson, formatReportMarkdown } from "../errorReport";
import { resetToastDedupeState } from "../appFeedback.dedupe";
import { clearErrorReports } from "@/lib/diagnostics/errorDetailsStore";
import { safeReportJson } from "@/lib/diagnostics/safeReportValue";

const mocks = vi.hoisted(() => ({
  error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), dismiss: vi.fn(), sentry: vi.fn(), open: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: mocks.sentry }));
vi.mock("@/lib/diagnostics/errorDetailsStore", () => ({
  openErrorReport: mocks.open, rememberErrorReport: vi.fn(), offerErrorRecovery: vi.fn(), clearErrorReports: vi.fn(),
}));
beforeEach(() => { vi.clearAllMocks(); resetToastDedupeState(); clearErrorReports(); });
function controls(kind: "error" | "warning" | "info") { return mocks[kind].mock.calls.at(-1)?.[1]; }
function readReport(kind: "error" | "warning" | "info" = "error") {
  const opts = controls(kind);
  (opts.cancel ?? opts.action).onClick();
  return JSON.parse(formatReportJson(mocks.open.mock.calls.at(-1)?.[0]));
}

describe("Copyable error report contract", () => {
  it("validation without exception has JSON with complete validation messages", () => {
    notifyError(undefined, { title: "Revisa los datos", errors: { cliente: "Falta cliente", puerto: "Falta puerto" } });
    expect(readReport().errors).toEqual({ cliente: "Falta cliente", puerto: "Falta puerto" });
  });
  it("preserves backend ID separately from generated client ID", () => {
    notifyError(undefined, { title: "Falló", requestId: "backend-123", error: new Error("fallo") });
    expect(readReport()).toMatchObject({ requestId: "backend-123", requestIdSource: "backend" });
    expect(readReport().clientReportId).not.toBe("backend-123");
  });
  it("preserves expected provider error and never reports it to Sentry", () => {
    const error = Object.assign(new Error("RFC inválido"), { expected: true, codigoSat: "402", detallesSat: { logId: "log-123" } });
    notifyError(undefined, { title: "Revisa los datos fiscales", error, method: "TIMBRAR", context: { facturaId: "MOCK" } });
    expect(readReport("warning")).toMatchObject({ method: "TIMBRAR", context: { facturaId: "MOCK" },
      errorDetails: { expected: true, codigoSat: "402", detallesSat: { logId: "log-123" } } });
    expect(mocks.sentry).not.toHaveBeenCalled();
  });
  it("warning and info keep details alongside Reintentar", () => {
    const options = { title: "Servicio no disponible", error: new Error("MOCK"), action: { label: "Reintentar", onClick: vi.fn() } };
    notifyWarning(undefined, options); notifyInfo(undefined, options);
    for (const kind of ["warning", "info"] as const) {
      expect(controls(kind).action.label).toBe("Reintentar");
      expect(controls(kind).cancel.label).toBe("Ver detalles");
    }
  });
  it("plain warning also has a useful minimal report", () => {
    notifyWarning(undefined, { title: "Falta completar información" });
    expect(readReport("warning").errorDetails.message).toBe("Falta completar información");
  });
  it("repeated partial workflow notice refreshes its diagnostic even without an exception", () => {
    notifyInfo(undefined, { title: "Envío parcial", method: "ENVIAR_EMAIL", payload: { errores: ["Primero"] } });
    notifyInfo(undefined, { title: "Envío parcial", method: "ENVIAR_EMAIL", payload: { errores: ["Segundo"] } });
    expect(mocks.info).toHaveBeenCalledTimes(2);
    expect(readReport("info").payload.errores).toEqual(["Segundo"]);
  });
  it("unrelated generic failures do not share toast ID", () => {
    notifyError(undefined, { title: "Error A" }); notifyError(undefined, { title: "Error B" });
    expect(mocks.error.mock.calls[0][1].id).not.toBe(mocks.error.mock.calls[1][1].id);
  });
  it("same message in different entities keeps independent diagnostics", () => {
    notifyError(undefined, { title: "Falló", method: "GUARDAR", context: { id: "a" } });
    notifyError(undefined, { title: "Falló", method: "GUARDAR", context: { id: "b" } });
    expect(mocks.error.mock.calls[0][1].id).not.toBe(mocks.error.mock.calls[1][1].id);
  });
  it("repeated failure updates report rather than suppressing the latest request", () => {
    notifyError(undefined, { title: "Falló", error: new Error("Primero"), method: "GUARDAR" });
    notifyError(undefined, { title: "Falló", error: new Error("Segundo"), method: "GUARDAR" });
    expect(mocks.error).toHaveBeenCalledTimes(2);
    expect(readReport().errorDetails.message).toBe("Segundo");
    dismissAllToasts();
    notifyError(undefined, { title: "Falló", error: new Error("Tercero"), method: "GUARDAR" });
    expect(readReport().errorDetails.message).toBe("Tercero");
  });
  it("safe JSON handles circular context/error, BigInt and repeated non-circular references", () => {
    const context: Record<string, unknown> = { amount: 10n }; context.self = context;
    const error: Record<string, unknown> = {}; error.self = error;
    const report = buildErrorReport({ title: "MOCK", context, error });
    expect(() => formatReportMarkdown(report)).not.toThrow();
    expect(JSON.parse(formatReportJson(report)).context).toEqual({ amount: "10", self: "[Circular]" });
    const item = { id: "a" };
    expect(JSON.parse(safeReportJson({ first: item, second: item }))).toEqual({ first: item, second: item });
  });
  it("redacts secrets without invoking getters or toJSON", () => {
    const getter = vi.fn(() => { throw new Error("must not execute"); });
    const input = { password: "MOCK", access_token: "MOCK", toJSON: getter };
    Object.defineProperty(input, "danger", { get: getter });
    const result = JSON.parse(safeReportJson(input));
    expect(result.password).toBe("[REDACTADO]");
    expect(result.access_token).toBe("[REDACTADO]");
    expect(result.danger).toBe("[Accesor omitido]");
    expect(getter).not.toHaveBeenCalled();
  });
});
