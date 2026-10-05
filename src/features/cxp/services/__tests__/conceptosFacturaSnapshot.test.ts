import { beforeEach, describe, expect, it, vi } from "vitest";
const { cabecera, conceptos } = vi.hoisted(() => ({ cabecera: vi.fn(), conceptos: vi.fn() }));
vi.mock("../proveedorFacturas.update", () => ({ fetchFacturaParaEdicion: cabecera }));
vi.mock("../conceptosCfdiFactura", () => ({ fetchConceptosCfdi: conceptos }));
import { fetchConceptosFacturaSnapshot } from "../conceptosFacturaSnapshot";

describe("snapshot de edición de conceptos", () => {
  beforeEach(() => { cabecera.mockReset(); conceptos.mockReset().mockResolvedValue([{ id: "c1", descripcion: "Revisado" }]); });
  it("devuelve los renglones y la versión de la cabecera sólo si no hubo escritura intermedia", async () => {
    cabecera.mockResolvedValue({ id: "f1", updated_at: "v1" });
    await expect(fetchConceptosFacturaSnapshot("f1")).resolves.toEqual({
      factura: { id: "f1", updated_at: "v1" }, conceptos: [{ id: "c1", descripcion: "Revisado" }],
    });
    expect(cabecera).toHaveBeenCalledTimes(2);
  });
  it("rechaza una lectura que mezcla conceptos y cabecera de versiones distintas", async () => {
    cabecera.mockResolvedValueOnce({ id: "f1", updated_at: "v1" }).mockResolvedValueOnce({ id: "f1", updated_at: "v2" });
    await expect(fetchConceptosFacturaSnapshot("f1")).rejects.toThrow("LC_CONFLICTO_CONCURRENCIA");
  });
  it("falla cerrado si la factura desaparece o no dispone de versión", async () => {
    cabecera.mockResolvedValue(null);
    await expect(fetchConceptosFacturaSnapshot("f1")).rejects.toThrow("ya no existe");
    cabecera.mockResolvedValue({ id: "f1" });
    await expect(fetchConceptosFacturaSnapshot("f1")).rejects.toThrow("LC_CONFLICTO_CONCURRENCIA");
  });
});
