import { describe, expect, it } from "vitest";
import { esPagoAnticipo, origenPagoAnticipo, type AplicacionAnticipoOrigen } from "../pagoAnticipoOrigen";

const aplicacion = (): AplicacionAnticipoOrigen => ({
  id: "aplicacion-fixture", anticipo_id: "anticipo-fixture", deleted_at: null,
  anticipos_proveedor: {
    id: "anticipo-fixture", deleted_at: null, estado: "disponible", moneda: "MXN", metodo_pago: "Transferencia",
    cuenta_bancaria_id: "cuenta-fixture",
    bbva_movimientos: [{ id: "cargo-original-fixture", fecha: "2026-10-03", referencia: null, cargo: 25, abono: 0, deleted_at: null }],
  },
});
describe("Origen de una aplicación de anticipo", () => {
  it("resuelve el cargo original sin exigir un segundo movimiento del pago", () => {
    const origen = origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [aplicacion()] });
    expect(origen).toMatchObject({ tipo: "bancario", movimiento: { id: "cargo-original-fixture" } });
  });
  it("anticipo en efectivo reconoce cero cargos bancarios", () => {
    const app = aplicacion();
    app.anticipos_proveedor = { ...app.anticipos_proveedor!, metodo_pago: "Efectivo", cuenta_bancaria_id: null, bbva_movimientos: [] };
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [app] })?.tipo).toBe("efectivo");
  });
  it("flag o vínculo vivo protege edición aunque el origen sea inconsistente", () => {
    expect(esPagoAnticipo({ es_anticipo_aplicado: true })).toBe(true);
    expect(esPagoAnticipo({ es_anticipo_aplicado: false, anticipos_aplicaciones: [aplicacion()] })).toBe(true);
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true })?.tipo).toBe("inconsistente");
    expect(origenPagoAnticipo({ es_anticipo_aplicado: false, anticipos_aplicaciones: [aplicacion()] })?.tipo).toBe("inconsistente");
  });
  it("no presenta cargo cubierto con vínculos o movimientos ausentes/múltiples/borrados", () => {
    const app = aplicacion();
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [app, aplicacion()] })?.tipo).toBe("inconsistente");
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [{ ...app, deleted_at: "2026-10-03" }] })?.tipo).toBe("inconsistente");
    app.anticipos_proveedor!.bbva_movimientos = [];
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [app] })?.tipo).toBe("inconsistente");
    app.anticipos_proveedor!.bbva_movimientos = [aplicacion().anticipos_proveedor!.bbva_movimientos![0], aplicacion().anticipos_proveedor!.bbva_movimientos![0]];
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [app] })?.tipo).toBe("inconsistente");
  });
  it("un pago normal no se confunde con una aplicación revertida", () => {
    expect(origenPagoAnticipo({ es_anticipo_aplicado: false, anticipos_aplicaciones: [{ ...aplicacion(), deleted_at: "2026-10-03" }] })).toBeNull();
  });
  it.each(["cancelado", "Cancelado"])("un anticipo %s no presenta el cargo como origen válido", (estado) => {
    const app = aplicacion();
    app.anticipos_proveedor!.estado = estado;
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [app] })?.tipo).toBe("inconsistente");
  });
  it("aplicar 10 y devolver los 15 restantes conserva el cargo original de 25", () => {
    const app = aplicacion();
    app.anticipos_proveedor!.estado = "devuelto";
    app.anticipos_proveedor!.bbva_movimientos!.push({
      id: "devolucion-fixture", fecha: "2026-10-03", referencia: null, cargo: 0, abono: 15, deleted_at: null,
    });
    expect(origenPagoAnticipo({ es_anticipo_aplicado: true, anticipos_aplicaciones: [app] })).toMatchObject({
      tipo: "bancario", moneda: "MXN", movimiento: { id: "cargo-original-fixture", cargo: 25, abono: 0 },
    });
  });
});
