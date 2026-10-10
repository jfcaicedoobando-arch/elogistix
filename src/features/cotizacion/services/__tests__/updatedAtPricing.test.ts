import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: m.from } }));
import { fetchCotizacionSelloSync } from "../updatedAt";
beforeEach(() => { vi.clearAllMocks(); m.from.mockReturnValue(m); m.select.mockReturnValue(m); m.eq.mockReturnValue(m); m.is.mockReturnValue(m); });
describe("sello para sincronización Pricing", () => {
  it("lee juntos moneda persistida, TC, linaje y sello bajo los filtros existentes", async () => {
    m.maybeSingle.mockResolvedValue({ data: { updated_at: "stamp-A", moneda: "MXN", tipo_cambio_usd: 20, pricing_solicitud_id: "request-A" }, error: null });
    expect(await fetchCotizacionSelloSync("quote-A")).toEqual({ updatedAt: "stamp-A", moneda: "MXN", tipoCambioUsd: 20, pricingSolicitudId: "request-A" });
    expect(m.select).toHaveBeenCalledWith("updated_at, moneda, tipo_cambio_usd, pricing_solicitud_id");
    expect(m.eq).toHaveBeenCalledWith("id", "quote-A"); expect(m.is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("sin linaje devuelve null sin inferirlo desde otro origen", async () => {
    m.maybeSingle.mockResolvedValue({ data: { moneda: "USD", tipo_cambio_usd: null, pricing_solicitud_id: null }, error: null });
    expect(await fetchCotizacionSelloSync("quote-A")).toMatchObject({ moneda: "USD", tipoCambioUsd: null, pricingSolicitudId: null });
  });
  it("fila inaccesible no inventa una moneda", async () => {
    m.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(fetchCotizacionSelloSync("quote-A")).rejects.toThrow("no tienes acceso");
  });
});
