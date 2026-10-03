import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const error = vi.fn();
  const success = vi.fn();
  const warning = vi.fn();
  const base = vi.fn() as unknown as Record<string, unknown>;
  base.error = error;
  base.success = success;
  base.warning = warning;
  return { toast: base };
});

import { toast as sonnerToast } from "sonner";
import { notifyError, notifyWarning, notifySuccess, isAuthorizationError } from "../appFeedback";
import { resetToastDedupeState } from "../appFeedback.dedupe";

const reportCaughtErrorMock = vi.fn();
vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: (...args: unknown[]) => reportCaughtErrorMock(...args),
}));

const m = sonnerToast as unknown as {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  resetToastDedupeState();
  m.error.mockClear();
  m.success.mockClear();
  m.warning.mockClear();
  reportCaughtErrorMock.mockClear();
});

describe("appFeedback (sonner)", () => {
  it("notifyError con step usa título 'Revisa el Paso N: <nombre>'", () => {
    notifyError(undefined, { step: 2, errors: { puertoOrigen: "Puerto de origen: campo obligatorio." } });
    expect(m.error).toHaveBeenCalledWith(
      "Revisa el Paso 2: Ruta",
      expect.objectContaining({ description: "Puerto de origen: campo obligatorio." }),
    );
  });

  it("notifyError con phase usa título 'Error: <fase>'", () => {
    notifyError(undefined, { phase: "subida de documentos", message: "boom" });
    expect(m.error).toHaveBeenCalledWith(
      "Error: subida de documentos",
      expect.objectContaining({ description: "boom" }),
    );
  });

  // FIX-R3 (frontend_hunter P3): el id del toast no puede colapsar a un mismo
  // valor para errores de contextos distintos — se deriva del método.
  it("notifyError deriva el id del method cuando no hay errorCode ni phase", () => {
    notifyError(undefined, { title: "Falló", description: "x", method: "RECHAZAR_DOC_EMBARQUE" });
    expect(m.error).toHaveBeenCalledWith(
      "Falló",
      expect.objectContaining({ id: "err-RECHAZAR_DOC_EMBARQUE" }),
    );
  });

  it("notifyError prioriza errorCode sobre method para el id", () => {
    notifyError(undefined, { title: "Falló", description: "x", errorCode: "LC_PRUEBA", method: "M" });
    expect(m.error).toHaveBeenCalledWith(
      "Falló",
      expect.objectContaining({ id: "err-LC_PRUEBA" }),
    );
  });

  it("notifyWarning emite sonner.warning", () => {
    notifyWarning(undefined, { title: "Aviso", description: "ok" });
    expect(m.warning).toHaveBeenCalledWith(
      "Aviso",
      expect.objectContaining({ description: "ok", id: "warn-Aviso" }),
    );
  });

  it("notifySuccess emite sonner.success", () => {
    notifySuccess(undefined, { title: "Listo", description: "ok" });
    expect(m.success).toHaveBeenCalledWith(
      "Listo",
      expect.objectContaining({ description: "ok", id: "ok-Listo" }),
    );
  });

  // Ola 17 · higiene de toasts: doble clic rápido no debe apilar dos éxitos.
  it("notifySuccess deduplica por method (doble clic)", () => {
    notifySuccess(undefined, { title: "Pago registrado", method: "registrar_pago" });
    notifySuccess(undefined, { title: "Pago registrado", method: "registrar_pago" });
    const ids = m.success.mock.calls.map((c: unknown[]) => (c[1] as { id?: string }).id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe("ok-registrar_pago");
  });

  it("notifyWarning con persistent:true emite duration Infinity", () => {
    notifyWarning(undefined, { title: "Persistente", persistent: true });
    expect(m.warning).toHaveBeenCalledWith(
      "Persistente",
      expect.objectContaining({ duration: Infinity }),
    );
  });

  it("notifySuccess con persistent:true emite duration Infinity", () => {
    notifySuccess(undefined, { title: "Persistente", persistent: true });
    expect(m.success).toHaveBeenCalledWith(
      "Persistente",
      expect.objectContaining({ duration: Infinity }),
    );
  });

  it("isAuthorizationError detecta variantes conocidas", () => {
    expect(isAuthorizationError(new Error("No tienes permisos para X"))).toBe(true);
    expect(isAuthorizationError(new Error("permission denied for table"))).toBe(true);
    expect(isAuthorizationError(new Error("Forbidden"))).toBe(true);
    expect(isAuthorizationError(new Error("Network fail"))).toBe(false);
    expect(isAuthorizationError(null)).toBe(false);
  });

  it("notifyError NO envía a Sentry cuando el error es de autorización", () => {
    notifyError(undefined, {
      title: "Error al actualizar",
      error: new Error("No tienes permisos para cambiar el estado del cliente en esta proforma."),
      method: "PROFORMAS_RESPUESTA_MANUAL",
    });
    expect(m.error).toHaveBeenCalled();
    expect(reportCaughtErrorMock).not.toHaveBeenCalled();
  });

  it("notifyError SÍ envía a Sentry cuando el error no es de autorización", () => {
    notifyError(undefined, {
      title: "Error al actualizar",
      error: new Error("Network fail"),
      method: "PROFORMAS_RESPUESTA_MANUAL",
    });
    expect(m.error).toHaveBeenCalled();
    expect(reportCaughtErrorMock).toHaveBeenCalledTimes(1);
  });

  // v13.792.1 — errores de dominio esperados (`expected: true`, p. ej.
  // BuzonDuplicadoError): aviso amable, sin "Ver detalles" y sin Sentry.
  it("notifyError con error expected:true emite warning amable sin detalles ni Sentry", () => {
    const err = Object.assign(
      new Error("Este archivo ya fue capturado como factura de proveedor."),
      { expected: true },
    );
    notifyError(undefined, {
      title: "No se pudo subir la factura",
      error: err,
      method: "SUBIR_FACTURA_ENTRANTE",
    });
    expect(m.error).not.toHaveBeenCalled();
    expect(m.warning).toHaveBeenCalledWith(
      "No se pudo subir la factura",
      expect.objectContaining({
        description: "Este archivo ya fue capturado como factura de proveedor.",
        action: undefined,
      }),
    );
    expect(reportCaughtErrorMock).not.toHaveBeenCalled();
  });

  it("notifyError sin expected mantiene el flujo de error con detalles", () => {
    notifyError(undefined, {
      title: "No se pudo subir la factura",
      error: new Error("boom"),
      method: "SUBIR_FACTURA_ENTRANTE",
    });
    expect(m.warning).not.toHaveBeenCalled();
    expect(m.error).toHaveBeenCalled();
  });
});
