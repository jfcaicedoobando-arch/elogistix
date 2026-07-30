import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => mockFrom(t) },
}));

import {
  etiquetaFacturaVinculable,
  listarFacturasVinculablesEntrante,
} from "../facturasVinculablesEntrante";

function chain(data: unknown) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    is: vi.fn(() => api),
    neq: vi.fn(() => api),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return api;
}

describe("listarFacturasVinculablesEntrante", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excluye canceladas y borradas y normaliza montos", async () => {
    const api = chain([
      { id: "f1", folio_interno: "FP-000001", folio_proveedor: "A1", proveedor_nombre: "Maersk",
        uuid_fiscal: null, total: "1500.5", moneda: "USD", fecha_emision: "2026-07-01", estado: "Vigente" },
    ]);
    mockFrom.mockReturnValue(api);

    const res = await listarFacturasVinculablesEntrante("emb-1");

    expect(api.eq).toHaveBeenCalledWith("embarque_id", "emb-1");
    expect(api.is).toHaveBeenCalledWith("deleted_at", null);
    expect(api.neq).toHaveBeenCalledWith("estado", "Cancelada");
    expect(res[0].total).toBe(1500.5);
  });

  it("regresa lista vacía cuando no hay datos", async () => {
    mockFrom.mockReturnValue(chain(null));
    await expect(listarFacturasVinculablesEntrante("emb-2")).resolves.toEqual([]);
  });
});

describe("etiquetaFacturaVinculable", () => {
  it("usa folio interno y proveedor", () => {
    expect(etiquetaFacturaVinculable({
      id: "1", folio_interno: "FP-000009", folio_proveedor: null, proveedor_nombre: "Hapag",
      uuid_fiscal: null, total: 10, moneda: "MXN", fecha_emision: null, estado: "Vigente",
    })).toBe("FP-000009 · Hapag");
  });

  it("cae a folio del proveedor y luego a 'sin folio'", () => {
    const base = { id: "1", folio_interno: null, uuid_fiscal: null, total: 0, moneda: "MXN", fecha_emision: null, estado: "Vigente" };
    expect(etiquetaFacturaVinculable({ ...base, folio_proveedor: "B2", proveedor_nombre: null })).toBe("B2");
    expect(etiquetaFacturaVinculable({ ...base, folio_proveedor: null, proveedor_nombre: null })).toBe("sin folio");
  });
});
