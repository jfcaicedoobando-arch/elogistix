import { describe, expect, it } from "vitest";
import {
  proyectarFilasUtilidadVisible,
  proyectarUtilidadVisible,
} from "@/features/dashboard/domain/proyeccionVisible";

describe("proyeccionVisible (P2-B)", () => {
  it("la utilidad visible es la resta de la venta y el costo visibles (ELIMP00008)", () => {
    const fila = proyectarUtilidadVisible({
      ventaMXN: 61638.1538,
      costoMXN: 53137.525,
      profitMXN: 8500.6288, // crudo del RPC: se mostraba 8,500.63
    });
    expect(fila.ventaMXN).toBe(61638.15);
    expect(fila.costoMXN).toBe(53137.53);
    expect(fila.profitMXN).toBe(8500.62);
    expect(fila.profitMXN).toBe(fila.ventaMXN - fila.costoMXN);
  });

  it("recalcula el margen sólo cuando la fila lo trae", () => {
    const conMargen = proyectarUtilidadVisible({
      ventaMXN: 100, costoMXN: 40, profitMXN: 60, margenMXN: 59.9,
    });
    expect(conMargen.margenMXN).toBeCloseTo(60, 6);

    const sinMargen = proyectarUtilidadVisible({ ventaMXN: 100, costoMXN: 40, profitMXN: 60 });
    expect("margenMXN" in sinMargen).toBe(false);
  });

  it("no rompe filas en cero ni con pérdida", () => {
    expect(proyectarUtilidadVisible({ ventaMXN: 0, costoMXN: 0, profitMXN: 0, margenMXN: 0 }))
      .toMatchObject({ profitMXN: 0, margenMXN: 0 });
    expect(proyectarUtilidadVisible({ ventaMXN: 100.004, costoMXN: 150.006, profitMXN: -50 }).profitMXN)
      .toBe(-50.01);
  });

  it("conserva el resto de los campos de la fila", () => {
    const [fila] = proyectarFilasUtilidadVisible([
      { id: "e-1", expediente: "ELIMP00008", ventaMXN: 61638.1538, costoMXN: 53137.525, profitMXN: 0 },
    ]);
    expect(fila.id).toBe("e-1");
    expect(fila.expediente).toBe("ELIMP00008");
    expect(fila.profitMXN).toBe(8500.62);
  });

  it("los totales se proyectan con sus propios venta/costo, sin forzar la suma de filas", () => {
    const filas = proyectarFilasUtilidadVisible([
      { ventaMXN: 10.005, costoMXN: 0, profitMXN: 0 },
      { ventaMXN: 10.005, costoMXN: 0, profitMXN: 0 },
    ]);
    const total = proyectarUtilidadVisible({ ventaMXN: 20.01, costoMXN: 0, profitMXN: 0 });
    expect(filas.map((f) => f.profitMXN)).toEqual([10.01, 10.01]);
    expect(total.profitMXN).toBe(20.01); // coherente consigo mismo
  });
});
