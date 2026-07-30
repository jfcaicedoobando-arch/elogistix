/**
 * Regresión de `diffConceptos`: conteo correcto cuando hay varios conceptos con
 * el mismo nombre y proveedor (antes se colapsaban en un Map y la bitácora
 * reportaba 1 eliminado en lugar de 2).
 */
import { describe, it, expect } from "vitest";
import { diffConceptos } from "@/features/auditoria/utils/diffConceptos";

describe("diffConceptos · claves repetidas (regresión v13.363.0)", () => {
  it("cuenta cada fila eliminada aunque compartan nombre y proveedor", () => {
    const antes = [
      { descripcion: "Demoras", precio_unitario: 3680, cantidad: 1, moneda: "USD" },
      { descripcion: "Demoras", precio_unitario: 1120, cantidad: 1, moneda: "USD" },
      { descripcion: "Producto Generico", precio_unitario: 4005, cantidad: 1, moneda: "USD" },
    ];
    const despues = [antes[0]];

    const diff = diffConceptos(antes, despues);

    expect(diff.eliminados).toBe(2);
    expect(diff.agregados).toBe(0);
    expect(diff.detalle.filter((d) => d.tipo === "eliminado")).toHaveLength(2);
  });

  it("cuenta agregados duplicados por separado", () => {
    const diff = diffConceptos([], [
      { concepto: "Almacenaje", monto: 100, moneda: "MXN" },
      { concepto: "Almacenaje", monto: 250, moneda: "MXN" },
    ]);
    expect(diff.agregados).toBe(2);
  });

  it("detecta modificaciones de monto sin marcar alta/baja", () => {
    const diff = diffConceptos(
      [{ concepto: "Flete", monto: 100, moneda: "USD" }],
      [{ concepto: "Flete", monto: 150, moneda: "USD" }],
    );
    expect(diff).toMatchObject({ agregados: 0, eliminados: 0, modificados: 1 });
  });

  it("no reporta cambios cuando las listas son equivalentes", () => {
    const lista = [{ concepto: "Flete", monto: 100, moneda: "USD" }];
    expect(diffConceptos(lista, [...lista])).toMatchObject({
      agregados: 0,
      eliminados: 0,
      modificados: 0,
    });
  });
});
