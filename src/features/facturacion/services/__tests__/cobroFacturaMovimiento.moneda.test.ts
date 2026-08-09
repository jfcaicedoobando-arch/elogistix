/**
 * C4 — el abono bancario del cobro no debe usar el ratio pago→factura como TC
 * MXN/USD ni abonar en una cuenta de otra moneda.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn(() => Promise.resolve({ error: null }));
const facturaRow = { organization_id: "org-1", numero: "F1", clientes: { nombre: "ACME" } };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabla: string) => {
      if (tabla === "bbva_movimientos") {
        return {
          select: () => ({ eq: () => ({ is: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }),
          insert,
        };
      }
      if (tabla === "cuentas_bancarias") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { moneda: "MXN" } }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: facturaRow }) }) }) };
    },
  },
}));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { crearMovimientoBancarioCobro } = await import("../cobroFacturaMovimiento");

const base = {
  pagoId: "pago-1",
  facturaId: "fac-1",
  cuentaBancariaId: "cta-mxn",
  fechaPago: "2026-08-10",
  referencia: "SPEI",
  userId: "user-1",
};

describe("crearMovimientoBancarioCobro · moneda (C4)", () => {
  beforeEach(() => insert.mockClear());

  it("abona el importe tal cual cuando cobro y cuenta son MXN", async () => {
    const ok = await crearMovimientoBancarioCobro({
      ...base, monto: 5000, moneda: "MXN", tipoCambioUsd: null,
    });
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ abono: 5000 }));
  });

  it("no abona un cobro USD en una cuenta MXN sin TC oficial", async () => {
    const ok = await crearMovimientoBancarioCobro({
      ...base, monto: 1000, moneda: "USD", tipoCambioUsd: null,
    });
    expect(ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("con TC oficial convierte USD → MXN", async () => {
    await crearMovimientoBancarioCobro({
      ...base, monto: 1000, moneda: "USD", tipoCambioUsd: 17,
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ abono: 17000 }));
  });
});
