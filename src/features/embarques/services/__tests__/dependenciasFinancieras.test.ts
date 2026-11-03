import { describe, it, expect, beforeEach, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
import { fetchEmbarqueDependenciasFinancieras, DEPENDENCIAS_FINANCIERAS_ERROR } from "../dependenciasFinancieras";
import { AuthOperationChangedError, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { diagnosticoBaja, EMBARQUE_ID, OTRO_EMBARQUE_ID, FACTURA_ID } from "./fixtures/diagnosticoBaja.fixture";

function actor(organizationId = "org-a", effectiveRole = "admin_org") {
  setAuthSnapshot({ userId: "actor-a", email: null, organizationId, organizationName: null, role: effectiveRole, effectiveRole });
  syncActiveOrganizationScope({ userId: "actor-a", organizationId });
}
beforeEach(() => { vi.clearAllMocks(); actor(); });
function respond(data: unknown, error: unknown = null) {
  mock.rpc.mockImplementation(() => {
    const result = Promise.resolve({ data, error });
    return Object.assign(result, { abortSignal: vi.fn(() => result) });
  });
}

describe("diagnóstico canónico de baja", () => {
  it("consulta sólo la RPC autorizada y conserva el resultado vacío válido", async () => {
    respond(diagnosticoBaja());
    const result = await fetchEmbarqueDependenciasFinancieras(EMBARQUE_ID);
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("diagnosticar_baja_embarque", { p_embarque_id: EMBARQUE_ID });
    expect(mock.from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ tieneDependencias: false, cerrado: false, comisionesDefinitivas: 0 });
  });

  it("conserva conteos completos, ejemplos separados y todos los motivos del servidor", async () => {
    respond(diagnosticoBaja({ bloqueado: true, facturas: 21, cxp: 2, pagos_cxp: 1, notas_credito_cxc: 3,
      proformas: 1, cerrado: true, comisiones_definitivas: 2,
      ejemplos_cxc: [{ id: FACTURA_ID, folio: "F-FICTICIA", estado: "Borrador" }] }));
    const result = await fetchEmbarqueDependenciasFinancieras(EMBARQUE_ID);
    expect(result).toMatchObject({ tieneDependencias: true, cxc: { count: 21 }, cxp: { count: 2 }, pagos: 1,
      notasCredito: 3, proformas: 1, cerrado: true, comisionesDefinitivas: 2 });
    expect(result.cxc.facturas).toEqual([{ id: FACTURA_ID, folio: "F-FICTICIA", estado: "Borrador" }]);
  });

  it.each(["42501", "42883", "42703", "55P03"])("un fallo %s no ofrece confirmación ni fallback a tablas", async (code) => {
    respond(null, { code, message: "diagnóstico privado de SQL" });
    await expect(fetchEmbarqueDependenciasFinancieras(EMBARQUE_ID)).rejects.toThrow(DEPENDENCIAS_FINANCIERAS_ERROR);
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    null, {}, { ...diagnosticoBaja(), version: 2 }, { ...diagnosticoBaja(), embarque_id: OTRO_EMBARQUE_ID },
    { ...diagnosticoBaja(), facturas: -1 }, { ...diagnosticoBaja(), facturas: 0.5 },
    { ...diagnosticoBaja(), facturas: "1" }, { ...diagnosticoBaja(), cerrado: "false" },
    { ...diagnosticoBaja(), facturas: 1, bloqueado: false },
    { ...diagnosticoBaja(), bloqueado: true },
    { ...diagnosticoBaja(), ejemplos_cxc: [{ id: FACTURA_ID, folio: null, estado: null }] },
    { ...diagnosticoBaja(), facturas: 2, bloqueado: true, ejemplos_cxc: Array(2).fill({ id: FACTURA_ID, folio: null, estado: null }) },
    { ...diagnosticoBaja(), facturas: 21, bloqueado: true, ejemplos_cxc: Array(21).fill({ id: FACTURA_ID, folio: null, estado: null }) },
  ])("falla cerrado con respuesta inválida o incompatible %#", async (data) => {
    respond(data);
    await expect(fetchEmbarqueDependenciasFinancieras(EMBARQUE_ID)).rejects.toThrow(DEPENDENCIAS_FINANCIERAS_ERROR);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it.each(["empresa", "rol"])("descarta una respuesta pendiente tras cambiar %s", async (change) => {
    let finish!: (value: unknown) => void;
    mock.rpc.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const request = fetchEmbarqueDependenciasFinancieras(EMBARQUE_ID);
    actor(change === "empresa" ? "org-b" : "org-a", change === "rol" ? "customer_service" : "admin_org");
    finish({ data: diagnosticoBaja({ bloqueado: true, facturas: 1 }), error: null });
    await expect(request).rejects.toBeInstanceOf(AuthOperationChangedError);
  });

  it("propaga aborto sin sustituirlo por un diagnóstico vacío", async () => {
    const controller = new AbortController(); controller.abort();
    respond(diagnosticoBaja());
    await expect(fetchEmbarqueDependenciasFinancieras(EMBARQUE_ID, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
