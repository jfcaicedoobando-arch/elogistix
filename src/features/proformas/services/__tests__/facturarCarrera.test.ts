/**
 * A5 (v13.469.0) — la guarda anti-carrera de `marcarProformaFacturada` debe
 * fallar cuando el UPDATE condicionado (`factura_id IS NULL`) no afecta filas:
 * significa que otro usuario/tab ya facturó la proforma.
 *
 * Ola 4 · N16 — el índice único parcial `uq_facturas_proforma_moneda_viva`
 * también protege el INSERT de facturas: su 23505 se traduce al mismo
 * código de dominio `LC_PROFORMA_YA_FACTURADA`.
 *
 * Mock dedicado (distinto al del test principal) porque aquí el resultado de la
 * tabla `proformas` debe diferir entre la lectura y el UPDATE ... RETURNING.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = await vi.hoisted(async () => ({ filasActualizadas: [] as unknown[] }));

const mock = await vi.hoisted(async () => {
  const proforma = {
    id: "prof-1",
    organization_id: "org-1",
    embarque_id: "emb-1",
    cliente_id: "cli-1",
    cliente_nombre: "ACME",
    expediente: "EXP-1",
    dias_credito: 0,
    subtotal_usd: 100, iva_usd: 16, total_usd: 116,
    subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0,
    factura_id: null,
  };

  function chain(table: string) {
    let esUpdate = false;
    const self: Record<string, unknown> = {};
    const paso = (label: string) => () => {
      if (label === "update") esUpdate = true;
      return self;
    };
    for (const op of ["select", "insert", "update", "eq", "is", "order", "limit"]) {
      self[op] = paso(op);
    }
    const resolver = () => {
      if (table === "facturas") {
        const err = (globalThis as { __facturasError?: unknown }).__facturasError;
        if (err) return { data: null, error: err };
        return { data: [{ id: "f-usd" }], error: null };
      }
      if (table === "proformas" && esUpdate) {
        return { data: (globalThis as { __filas?: unknown[] }).__filas ?? [], error: null };
      }
      return { data: proforma, error: null };
    };
    self.single = () => Promise.resolve(resolver());
    self.maybeSingle = () => Promise.resolve(resolver());
    self.then = (onFulfilled: (r: unknown) => unknown) =>
      Promise.resolve(resolver()).then(onFulfilled);
    return self;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => chain(table)),
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }) })) },
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { marcarProformaFacturada } from "@/features/proformas/services/facturar";

const params = {
  proformaId: "prof-1",
  folioFacturaExterna: "F-1",
  fechaFacturacion: "2026-05-01",
};

beforeEach(() => {
  (globalThis as { __facturasError?: unknown }).__facturasError = undefined;
});

describe("marcarProformaFacturada · guarda anti-carrera (A5)", () => {
  it("falla cuando el UPDATE no afecta ninguna fila (otro proceso ganó)", async () => {
    (globalThis as { __filas?: unknown[] }).__filas = [];
    await expect(marcarProformaFacturada(params)).rejects.toThrow(
      "LC_PROFORMA_YA_FACTURADA",
    );
    expect(state.filasActualizadas).toEqual([]);
  });

  it("pasa cuando el UPDATE afecta exactamente una fila", async () => {
    (globalThis as { __filas?: unknown[] }).__filas = [{ id: "prof-1" }];
    await expect(marcarProformaFacturada(params)).resolves.toBeUndefined();
  });
});

describe("marcarProformaFacturada · índice único uq_facturas_proforma_moneda_viva (N16)", () => {
  it("traduce 23505 del INSERT de facturas a LC_PROFORMA_YA_FACTURADA", async () => {
    (globalThis as { __facturasError?: unknown }).__facturasError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "uq_facturas_proforma_moneda_viva"',
    };
    await expect(marcarProformaFacturada(params)).rejects.toThrow(
      "LC_PROFORMA_YA_FACTURADA",
    );
  });

  it("propaga otros errores de INSERT sin traducirlos (no es 23505)", async () => {
    (globalThis as { __facturasError?: unknown }).__facturasError = {
      code: "42501",
      message: "permission denied",
    };
    await expect(marcarProformaFacturada(params)).rejects.toThrow(
      /Error al crear factura/,
    );
  });
});
