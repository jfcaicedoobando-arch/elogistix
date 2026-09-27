import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, actividad } = vi.hoisted(() => ({ rpc: vi.fn(), actividad: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: actividad }));
import { reemplazarConceptosFactura } from "../conceptosFacturaEditar";

const conceptos = [{ descripcion: "Maniobras", cantidad: 1, importe: 1000, iva: 172.8, ieps: 80 }];
describe("conceptosFacturaEditar · impuestos explícitos", () => {
  beforeEach(() => { rpc.mockReset().mockResolvedValue({ data: 1, error: null }); actividad.mockReset().mockResolvedValue(undefined); });
  it("el cliente anterior omite ajustes para que el servidor conserve los globales", async () => {
    await reemplazarConceptosFactura({ facturaId: "f1", conceptos });
    expect(rpc).toHaveBeenCalledWith("reemplazar_conceptos_factura_proveedor", {
      p_factura_id: "f1", p_conceptos: [expect.objectContaining({ monto: 1000, iva: 172.8, ieps: 80 })],
    });
  });
  it("envía ceros explícitos al distribuir IEPS y los conserva en bitácora", async () => {
    await reemplazarConceptosFactura({ facturaId: "f1", conceptos, impuestosNoDesglosados: { iva: 0, ieps: 0 } });
    expect(rpc).toHaveBeenCalledWith("reemplazar_conceptos_factura_proveedor", expect.objectContaining({
      p_impuestos_no_desglosados: { iva: 0, ieps: 0 },
    }));
    expect(actividad).toHaveBeenCalledWith(expect.objectContaining({
      detalles: { conceptos: 1, impuestos_no_desglosados: { iva: 0, ieps: 0 } },
    }));
  });
  it("no registra éxito si el servidor rechaza la operación", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("LC_CONCEPTOS_FISCALES") });
    await expect(reemplazarConceptosFactura({ facturaId: "f1", conceptos })).rejects.toThrow("LC_CONCEPTOS_FISCALES");
    expect(actividad).not.toHaveBeenCalled();
  });
});
