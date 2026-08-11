/**
 * v13.508.0 — Corrección de datos declarados de un documento del buzón CxP.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const registrarActividad = vi.fn();
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...a: unknown[]) => registrarActividad(...a),
}));

const { actualizarDatosEntrante, reemplazarConceptosEntrante } = await import(
  "../facturasEntrantesEditar"
);

const DATOS = {
  proveedorId: "prov-1",
  montoDeclarado: 1500,
  monedaDeclarada: "USD",
  nota: "  ajuste  ",
  sinCostoCapturado: false,
};

describe("actualizarDatosEntrante", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    registrarActividad.mockReset().mockResolvedValue(undefined);
  });

  it("manda los datos declarados a la RPC y registra la bitácora", async () => {
    await actualizarDatosEntrante("doc-1", DATOS, "f.pdf");
    expect(rpc).toHaveBeenCalledWith("actualizar_datos_entrante", expect.objectContaining({
      p_documento_id: "doc-1",
      p_proveedor_id: "prov-1",
      p_monto_declarado: 1500,
      p_moneda_declarada: "USD",
      p_nota: "ajuste",
      p_sin_costo_capturado: false,
    }));
    expect(registrarActividad).toHaveBeenCalledWith(expect.objectContaining({
      accion: "corregir_datos_entrante",
    }));
  });

  it("no envía moneda cuando no hay monto declarado", async () => {
    await actualizarDatosEntrante("doc-1", { ...DATOS, montoDeclarado: null });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_monto_declarado: null, p_moneda_declarada: null });
  });

  it("propaga el error de la RPC", async () => {
    rpc.mockResolvedValue({ error: { message: "LC_ENTRANTE_NO_EDITABLE" } });
    await expect(actualizarDatosEntrante("doc-1", DATOS)).rejects.toMatchObject({
      message: "LC_ENTRANTE_NO_EDITABLE",
    });
  });
});

describe("reemplazarConceptosEntrante", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    registrarActividad.mockReset().mockResolvedValue(undefined);
  });

  it("traduce la selección al shape de la RPC", async () => {
    await reemplazarConceptosEntrante("doc-1", [{ conceptoId: "c1", monto: 10 }], "f.pdf");
    expect(rpc).toHaveBeenCalledWith("reemplazar_conceptos_entrante", {
      p_documento_id: "doc-1",
      p_conceptos: [{ concepto_costo_id: "c1", monto_sugerido: 10 }],
    });
  });

  it("acepta una lista vacía (deja el documento sin sugerencias)", async () => {
    await reemplazarConceptosEntrante("doc-1", []);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_conceptos: [] });
    expect(registrarActividad).toHaveBeenCalledWith(expect.objectContaining({
      detalles: { conceptos: 0 },
    }));
  });
});
