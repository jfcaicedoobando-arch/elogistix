import { describe, it, expect, vi } from "vitest";
import { isExpectedBusinessError } from "@/lib/query/queryErrorReporting";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

describe("fixes Sentry oct-2026", () => {
  it("error marcado expected no se reporta (REACT-73)", () => {
    expect(isExpectedBusinessError({ name: "FacturapiError", message: "x", expected: true })).toBe(true);
    expect(isExpectedBusinessError({ name: "Error", message: "x", expected: false })).toBe(false);
  });
  it("historial de factura inexistente devuelve vacío (REACT-6Z/70/71)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "factura_not_found" } });
    const { fetchHistorialFacturaEmitida } = await import("@/features/facturacion/services/historialFactura");
    await expect(fetchHistorialFacturaEmitida("f1")).resolves.toEqual([]);
  });
});
