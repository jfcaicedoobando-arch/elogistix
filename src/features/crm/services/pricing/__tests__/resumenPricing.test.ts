import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAP_LISTA } from "@/constants/queryCaps";
import { obtenerResumenPricing } from "../resumenPricing";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), neq: vi.fn(), order: vi.fn(), limit: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
beforeEach(() => {
  vi.resetAllMocks();
  for (const method of [mocks.from, mocks.select, mocks.eq, mocks.is, mocks.neq, mocks.order]) method.mockReturnValue(mocks);
  mocks.limit.mockResolvedValue({ data: [], error: null });
});
describe("obtenerResumenPricing", () => {
  it("acota empresa y conserva filtro soft-delete, exclusión de borradores y límite", async () => {
    await obtenerResumenPricing("org-b");
    expect(mocks.from).toHaveBeenCalledWith("crm_solicitudes_pricing");
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", "org-b");
    expect(mocks.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.neq).toHaveBeenCalledWith("estado", "borrador");
    expect(mocks.limit).toHaveBeenCalledWith(CAP_LISTA);
  });
  it("rechaza consultar sin empresa antes de acceder a Supabase", async () => {
    await expect(obtenerResumenPricing(null)).rejects.toThrow("Selecciona una empresa");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("propaga el error original para que la UI permita reintentar", async () => {
    const error = new Error("sin conexión");
    mocks.limit.mockResolvedValue({ data: null, error });
    await expect(obtenerResumenPricing("org-a")).rejects.toBe(error);
  });
  it("mantiene los conteos, promedio y respuestas a tiempo", async () => {
    mocks.limit.mockResolvedValue({ error: null, data: [
      { estado: "respondida", created_at: "2026-10-07T00:00:00Z", respondida_at: "2026-10-07T04:00:00Z", vence_at: "2026-10-07T08:00:00Z" },
      { estado: "respondida", created_at: "2026-10-07T00:00:00Z", respondida_at: "2026-10-07T08:00:00Z", vence_at: "2026-10-07T04:00:00Z" },
      { estado: "enviada", created_at: "2026-10-07T00:00:00Z", respondida_at: null, vence_at: null },
    ] });
    expect(await obtenerResumenPricing("org-a")).toMatchObject({ total: 3, respondidas: 2, horasPromedioRespuesta: 6, respondidasATiempo: 1 });
  });
});
