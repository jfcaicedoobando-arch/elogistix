/**
 * Tests para vincular factura de proveedor ↔ conceptos_costo (Fase 1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createSupabaseMock(),
}));

import { supabase } from "@/integrations/supabase/client";
import {
  fetchConceptosCostoAbiertosDeProveedor,
  vincularFacturaAConceptos,
} from "../conceptosCostoVinculables";

const sb = supabase as unknown as ReturnType<typeof createSupabaseMock>;

describe("fetchConceptosCostoAbiertosDeProveedor", () => {
  beforeEach(() => sb.__reset());

  it("regresa vacío si no hay proveedorId", async () => {
    const out = await fetchConceptosCostoAbiertosDeProveedor("", "org-1");
    expect(out).toEqual([]);
  });

  it("mapea filas con expediente del embarque embed", async () => {
    sb.__setResult({
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
    sb.__setResult({ data: null, error: { message: "boom" } });
    await expect(fetchConceptosCostoAbiertosDeProveedor("p", "o")).rejects.toBeTruthy();
  });
});

describe("vincularFacturaAConceptos", () => {
  beforeEach(() => sb.__reset());

  it("no inserta nada si no hay líneas", async () => {
    const res = await vincularFacturaAConceptos({
      facturaId: "f-1", organizationId: "o-1", folio: "A-1",
      fechaEmision: "2026-06-12", lineas: [],
    });
    expect(res).toEqual({ insertadas: 0, liquidados: [] });
  });

  it("inserta líneas y marca como Pagados los conceptos cubiertos ≥99%", async () => {
    sb.__setResult({ data: null, error: null }); // insert OK
    sb.__setResult({ data: null, error: null }); // update OK
    const res = await vincularFacturaAConceptos({
      facturaId: "f-1", organizationId: "o-1", folio: "A-1",
      fechaEmision: "2026-06-12",
      lineas: [
        { conceptoCostoId: "cc-1", descripcion: "Flete", monto: 1000, montoOriginal: 1000 },
        { conceptoCostoId: "cc-2", descripcion: "THC", monto: 50, montoOriginal: 200 },
      ],
    });
    expect(res.insertadas).toBe(2);
    expect(res.liquidados).toEqual(["cc-1"]); // sólo el primero cubre ≥99%
  });

  it("no llama al update si ningún concepto se cubre", async () => {
    sb.__setResult({ data: null, error: null }); // insert OK
    const res = await vincularFacturaAConceptos({
      facturaId: "f-1", organizationId: "o-1", folio: "A-1",
      fechaEmision: "2026-06-12",
      lineas: [{ conceptoCostoId: "cc-1", descripcion: "X", monto: 100, montoOriginal: 1000 }],
    });
    expect(res).toEqual({ insertadas: 1, liquidados: [] });
  });
});
