import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizarConceptoPersistible, calcularCuadreCaptura } from "../../utils/conceptosPersistibles";

const { insert, from, registrarActividad } = vi.hoisted(() => ({
  insert: vi.fn(), from: vi.fn(), registrarActividad: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad }));
import { insertarConceptosCfdi } from "../conceptosCfdiFactura";

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  from.mockReturnValue({ insert });
});

describe("conceptos CxP · representación persistible", () => {
  it("normaliza importación y persiste exactamente el precio usado en el preview sin vínculo", async () => {
    const crudo = { descripcion: "Almacenaje", cantidad: 100, importe: 0.014, iva: 0, ieps: 0 };
    const normalizado = normalizarConceptoPersistible(crudo);
    const preview = calcularCuadreCaptura(1, [{ monto: normalizado.importe, cantidad: normalizado.cantidad }]);
    await insertarConceptosCfdi({ facturaId: "f1", organizationId: "org", conceptos: [crudo] });
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({
      monto: 0.01, cantidad: 100, concepto_costo_id: null, proveedor_factura_id: "f1",
    })]);
    const [fila] = insert.mock.calls[0][0];
    expect(fila.monto * fila.cantidad).toBe(preview.suma);
    expect(preview.puedeAprobar).toBe(true);
    expect(crudo.importe).toBe(0.014);
  });

  it("no usa tolerancia por cantidad para ocultar el descuadre de 0.40", () => {
    expect(calcularCuadreCaptura(1.4, [{ monto: 0.014, cantidad: 100 }])).toMatchObject({
      suma: 1, diferencia: 0.4, estado: "faltante", puedeAprobar: false,
    });
  });

  it("rechaza cantidades bajo el mínimo sin escribir ni reconvertir cero a uno", async () => {
    const crudo = { descripcion: "Servicio", cantidad: 0.0000001, importe: 100, iva: 0, ieps: 0 };
    const c = normalizarConceptoPersistible(crudo);
    expect(c.cantidad).toBe(0);
    expect(normalizarConceptoPersistible(c).cantidad).toBe(0);
    await expect(insertarConceptosCfdi({ facturaId: "f1", organizationId: "org", conceptos: [crudo] })).rejects.toThrow("0.000001");
    expect(insert).not.toHaveBeenCalled();
  });

  it("normalización idempotente conserva seis decimales de cantidad e importes canónicos", () => {
    const c = normalizarConceptoPersistible({ descripcion: "Servicio", cantidad: 1.234567, importe: 2.505, iva: 0.005, ieps: 0 });
    expect(c).toMatchObject({ cantidad: 1.234567, importe: 2.51, iva: 0.01 });
    expect(normalizarConceptoPersistible(c)).toEqual(c);
  });
});
