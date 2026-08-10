/**
 * F4 (audit Sentry 13.65.0) + 13.141.8 (contexto enriquecido):
 * valida que `reportCaughtError`:
 *  - llama a `captureException` con dynamic import (no acopla el SDK).
 *  - enriquece tags con organization_id, route, error_kind, pg_code.
 *  - sanitiza `payload` (redacta claves sensibles).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setErrorContext,
  __resetErrorContextForTests,
} from "../errorContextStore";

const mocks = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react", () => mocks);

import { reportCaughtError } from "../reportCaughtError";

// El reporte usa `import()` dinámico: bajo carga (varios workers) puede
// tardar más de un macrotask, así que esperamos hasta ver la llamada.
async function flush() {
  for (let i = 0; i < 200 && mocks.captureException.mock.calls.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  await Promise.resolve();
}

beforeEach(() => {
  mocks.captureException.mockClear();
  __resetErrorContextForTests();
});
afterEach(() => vi.clearAllMocks());

describe("reportCaughtError", () => {
  it("incluye tags ambientales (organization_id, route, app_version, error_kind)", async () => {
    setErrorContext({
      organizationId: "org-42",
      effectiveRole: "admin_org",
      route: "/configuracion",
    });
    reportCaughtError(new Error("boom"), { feature: "facturacion", op: "x" });
    await flush();
    const calls = mocks.captureException.mock.calls;
    const call = calls[calls.length - 1];
    expect(call[1].tags).toMatchObject({
      feature: "facturacion",
      op: "x",
      organization_id: "org-42",
      effective_role: "admin_org",
      route: "/configuracion",
      error_kind: "unknown",
    });
    expect(call[1].tags.app_version).toBeTruthy();
  });

  it("clasifica db_error y agrega pg_code/pg_hint", async () => {
    const pgError = {
      code: "42703",
      message: 'column "user_id" does not exist',
      hint: "use usuario_id",
      details: "in bitacora_actividad",
    };
    reportCaughtError(pgError, { feature: "facturapi", op: "set_key" });
    await flush();
    const calls = mocks.captureException.mock.calls;
    const call = calls[calls.length - 1];
    expect(call[1].tags.error_kind).toBe("db_error");
    expect(call[1].tags.pg_code).toBe("42703");
    expect(call[1].extra.pg_hint).toBe("use usuario_id");
    expect(call[1].extra.pg_details).toBe("in bitacora_actividad");
  });

  it("sanitiza el payload (redacta claves sensibles)", async () => {
    reportCaughtError(
      new Error("x"),
      { feature: "facturapi", op: "set_key" },
      { payload: { ambiente: "sandbox", api_key: "sk_live_secret" } },
    );
    await flush();
    const calls = mocks.captureException.mock.calls;
    const call = calls[calls.length - 1];
    expect(call[1].extra.payload).toEqual({
      ambiente: "sandbox",
      api_key: "[REDACTED]",
    });
  });

  it("no lanza si el SDK falla — best effort", async () => {
    mocks.captureException.mockImplementationOnce(() => {
      throw new Error("sdk-init-failed");
    });
    expect(() => reportCaughtError(new Error("x"), { feature: "pnl" })).not.toThrow();
    await flush();
  });

  it("envuelve PostgrestError plano en Error real (evita título 'Object captured as exception')", async () => {
    const pgError = { code: "22007", message: 'invalid input syntax for type date: ""' };
    reportCaughtError(pgError, { feature: "costeo", op: "insert_tarifa" });
    await flush();
    const calls = mocks.captureException.mock.calls;
    const call = calls[calls.length - 1];
    expect(call[0]).toBeInstanceOf(Error);
    expect((call[0] as Error).message).toBe('invalid input syntax for type date: ""');
    expect(call[1].extra.original).toBe(pgError);
  });

  it("descarta violaciones 23514 (validaciones de negocio esperadas)", async () => {
    const pgError = {
      code: "23514",
      message: "Tu rol requiere vincular una cotización Aceptada.",
      hint: "Selecciona una cotización en el paso 1.",
    };
    reportCaughtError(pgError, { feature: "embarques", op: "create" });
    await flush();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });



  it("descarta P0001 con prefijo LC_ (errores de dominio esperados)", async () => {
    const pgError = {
      code: "P0001",
      message: "LC_TRANSICION_INVALIDA: no se permite pasar de Borrador a Confirmado",
      hint: '{"expediente":"ELIMP00331"}',
    };
    reportCaughtError(pgError, { feature: "embarques", op: "avanzar_estado" });
    await flush();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("NO descarta P0001 sin prefijo LC_ (regresión: raises genéricos siguen llegando)", async () => {
    const pgError = {
      code: "P0001",
      message: "algo inesperado ocurrió en un trigger sin categorizar",
    };
    reportCaughtError(pgError, { feature: "embarques", op: "otro" });
    await flush();
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
});

