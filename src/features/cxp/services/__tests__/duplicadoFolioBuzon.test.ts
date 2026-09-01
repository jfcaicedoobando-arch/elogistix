/**
 * v13.414.0 — Cobertura del aviso de folio duplicado con enlace a la factura
 * existente y del dedupe de documentos gemelos en el buzón CxP.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { buscarFacturaDuplicadaFolio } from "../proveedorFacturas";
import { subirFacturaEntrante } from "../facturasEntrantesUpload";

describe("buscarFacturaDuplicadaFolio", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("devuelve el resumen de la factura existente", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [{
        id: "f1", folio_interno: "FP-000048", folio_proveedor: "DEBIT1",
        proveedor_nombre: "HK LS", estado: "Vigente", estado_aprobacion: "aprobada",
      }],
      error: null,
    });
    const res = await buscarFacturaDuplicadaFolio("p1", " DEBIT1 ", "2026-06-15");
    expect(res?.id).toBe("f1");
    expect(res?.folio_interno).toBe("FP-000048");
  });

  it("devuelve null sin consultar si no hay fecha de emisión", async () => {
    const res = await buscarFacturaDuplicadaFolio("p1", "DEBIT1", "");
    expect(res).toBeNull();
    expect(mock.tableCalls.find((c) => c.table === "proveedor_facturas")).toBeUndefined();
  });

  it("devuelve null cuando no hay coincidencias", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    expect(await buscarFacturaDuplicadaFolio("p1", "DEBIT1", "2026-06-15")).toBeNull();
  });
});

function archivo(): File {
  return new File([new Uint8Array([1, 2, 3])], "nota.pdf", { type: "application/pdf" });
}

describe("subirFacturaEntrante — dedupe del buzón", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("bloquea el gemelo pendiente de captura", async () => {
    // v13.821.2 — El dedupe ya no lee la tabla: la ubicación la resuelve la
    // RPC canónica `buzon_localizar_duplicado` (v13.819.2).
    mock.setRpcResult("buzon_localizar_duplicado", {
      data: [{ caso: "buzon_pendiente" }], error: null,
    });
    await expect(subirFacturaEntrante({
      pdf: archivo(), xml: null, embarqueId: "e1", organizationId: "o1",
    })).rejects.toThrow(/ya está en el buzón/i);
  });

  it("avisa cuando el archivo ya fue capturado como factura del embarque", async () => {
    mock.setRpcResult("buzon_localizar_duplicado", {
      data: [{ caso: "mismo_embarque", factura_id: "f9" }], error: null,
    });
    await expect(subirFacturaEntrante({
      pdf: archivo(), xml: null, embarqueId: "e1", organizationId: "o1",
    })).rejects.toThrow(/ya está registrada en este embarque/i);
  });
});
