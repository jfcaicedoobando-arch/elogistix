import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: vi.fn() }));
vi.mock("../../domain/seguroFacturaSelector", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../domain/seguroFacturaSelector")>(),
  SEGURO_FACTURA_SELECTOR_ENABLED: false,
}));
import { fetchFacturasSeguroElegibles } from "../seguros";
import { SEGURO_FACTURA_SELECTOR_ENABLED, SEGURO_FACTURA_SELECTOR_ERROR } from "../../domain/seguroFacturaSelector";

it("a disabled rollback gate makes no RPC/table request and returns generic unavailability", async () => {
  expect(SEGURO_FACTURA_SELECTOR_ENABLED).toBe(false);
  await expect(fetchFacturasSeguroElegibles({ embarqueId: "shipment", prima: "100", moneda: "MXN" })).rejects.toThrow(SEGURO_FACTURA_SELECTOR_ERROR);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});
