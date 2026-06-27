/**
 * Tests para vincular factura de proveedor ↔ conceptos_costo (Fase 1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchConceptosCostoAbiertosDeProveedor,
  vincularFacturaAConceptos,
} from "../conceptosCostoVinculables";

describe("fetchConceptosCostoAbiertosDeProveedor", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
    mock.resetResults();
  });

  it("regresa vacío si no hay proveedorId", async () => {
    const out = await fetchConceptosCostoAbiertosDeProveedor("", "org-1");
    expect(out).toEqual([]);
  });

  it("mapea filas con expediente del embarque embed", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [{
        id: "cc-1", embarque_id: "emb-1", concepto: "Flete", monto: "1000",
        moneda: "USD", fecha_vencimiento: null,
        embarques: { expediente: "MX-2025-001" },
      }],
      error: null,
    });
    const out = await fetchConceptosCostoAbiertosDeProveedor("prov-1", "org-1");
    expect(out).toEqual([{
      id: "cc-1", embarque_id: "emb-1", embarque_expediente: "MX-2025-001",
      concepto: "Flete", monto: 1000, moneda: "USD", fecha_vencimiento: null,
    }]);
  });

  it("lanza si Supabase devuelve error", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "boom" } });
    await expect(fetchConceptosCostoAbiertosDeProveedor("p", "o")).rejects.toThrow();
  });
});

describe("vincularFacturaAConceptos", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
    mock.resetResults();
    mock.setTableResult("proveedor_facturas_conceptos", { data: null, error: null });
    mock.setTableResult("conceptos_costo", { data: null, error: null });
  });

  it("no inserta nada si no hay líneas", async () => {
    const res = await vincularFacturaAConceptos({
      facturaId: "f-1", organizationId: "o-1", folio: "A-1",
      fechaEmision: "2026-06-12", lineas: [],
    });
    expect(res).toEqual({ insertadas: 0, liquidados: [] });
  });

  it("inserta líneas y marca como Pagados los conceptos cubiertos ≥99%", async () => {
    const res = await vincularFacturaAConceptos({
      facturaId: "f-1", organizationId: "o-1", folio: "A-1",
      fechaEmision: "2026-06-12",
      lineas: [
        { conceptoCostoId: "cc-1", descripcion: "Flete", monto: 1000, montoOriginal: 1000 },
        { conceptoCostoId: "cc-2", descripcion: "THC", monto: 50, montoOriginal: 200 },
      ],
    });
    expect(res.insertadas).toBe(2);
    expect(res.liquidados).toEqual(["cc-1"]); // sólo cc-1 cubre ≥99%
    const updatePayload = mock.getMutationPayload("conceptos_costo", "update") as
      { estado_liquidacion: string; referencia_pago: string } | null;
    expect(updatePayload?.estado_liquidacion).toBe("Pagado");
    expect(updatePayload?.referencia_pago).toBe("A-1");
  });

  it("no llama al update si ningún concepto se cubre", async () => {
    const res = await vincularFacturaAConceptos({
      facturaId: "f-1", organizationId: "o-1", folio: "A-1",
      fechaEmision: "2026-06-12",
      lineas: [{ conceptoCostoId: "cc-1", descripcion: "X", monto: 100, montoOriginal: 1000 }],
    });
    expect(res).toEqual({ insertadas: 1, liquidados: [] });
    expect(mock.getMutationPayload("conceptos_costo", "update")).toBeNull();
  });
});
