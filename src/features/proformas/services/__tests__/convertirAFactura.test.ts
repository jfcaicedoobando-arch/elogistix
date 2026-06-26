import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { convertirProformaAFactura } from "../convertirAFactura";

const baseParams = {
  proformaIds: ["p1"],
  serieId: "s1",
  metodoPago: "PUE" as const,
  formaPago: "03",
  usoCfdi: "G03",
};

describe("convertirProformaAFactura", () => {
  beforeEach(() => rpc.mockReset());

  it("rechaza cuando no hay proformas seleccionadas", async () => {
    await expect(convertirProformaAFactura({ ...baseParams, proformaIds: [] })).rejects.toThrow("Selecciona al menos una proforma");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("llama al RPC con defaults para opcionales", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "F-uuid", numero: "F-1" }, error: null });
    const res = await convertirProformaAFactura(baseParams);
    expect(res).toEqual({ facturaId: "F-uuid", facturaNumero: "F-1" });
    expect(rpc).toHaveBeenCalledWith("convertir_proformas_a_factura", {
      p_proforma_ids: ["p1"],
      p_serie_id: "s1",
      p_metodo_pago: "PUE",
      p_forma_pago: "03",
      p_uso_cfdi: "G03",
      p_dias_credito: 0,
      p_notas: undefined,
      p_request_id: undefined,
    });
  });

  it("pasa notas, diasCredito y requestId cuando se proveen", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "X", numero: "F-2" }, error: null });
    await convertirProformaAFactura({ ...baseParams, diasCredito: 15, notas: "nota", requestId: "req-1" });
    expect(rpc).toHaveBeenCalledWith("convertir_proformas_a_factura", expect.objectContaining({
      p_dias_credito: 15,
      p_notas: "nota",
      p_request_id: "req-1",
    }));
  });

  it("propaga el error del RPC", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "DB fail" } });
    await expect(convertirProformaAFactura(baseParams)).rejects.toMatchObject({ message: "DB fail" });
  });

  it("lanza cuando el RPC devuelve null", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(convertirProformaAFactura(baseParams)).rejects.toThrow("No se pudo generar la factura");
  });
});
