/** P1-1 coherencia · P1-3/P1-4/P2-5 linaje de costos automáticos. */
import { describe, it, expect } from "vitest";
import { errorCoherenciaRutaTarifa, MSG_ORIGEN_INCOHERENTE, MSG_DESTINO_INCOHERENTE } from "../coherenciaRutaTarifa";
import {
  marcarEditadaAMano, costosAutoDeOtraTarifa, conservarComoManuales, NOTA_AUTO_TARIFA,
} from "../costosAutoGenerados";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const base = { modo: "Marítimo", tarifaId: "t1", origen: "Ningbo, China (CNNGB)", destino: "Manzanillo, México (MXZLO)", puertoOrigenId: "p-ngb", puertoDestinoId: "p-zlo" };

describe("P1-1 · errorCoherenciaRutaTarifa", () => {
  it("coherente → null", () => {
    expect(errorCoherenciaRutaTarifa(base, { puerto_origen_id: "p-ngb", puerto_destino_id: "p-zlo" })).toBeNull();
  });
  it("ID del formulario distinto al de la tarifa → error de origen", () => {
    expect(errorCoherenciaRutaTarifa({ ...base, puertoOrigenId: "p-sha" }, { puerto_origen_id: "p-ngb", puerto_destino_id: "p-zlo" })).toBe(MSG_ORIGEN_INCOHERENTE);
  });
  it("texto vacío o ID faltante con tarifa → error", () => {
    expect(errorCoherenciaRutaTarifa({ ...base, origen: " " })).toBe(MSG_ORIGEN_INCOHERENTE);
    expect(errorCoherenciaRutaTarifa({ ...base, puertoDestinoId: null })).toBe(MSG_DESTINO_INCOHERENTE);
  });
  it("sin tarifa o fuera de marítimo no aplica", () => {
    expect(errorCoherenciaRutaTarifa({ ...base, tarifaId: null, puertoOrigenId: null })).toBeNull();
    expect(errorCoherenciaRutaTarifa({ ...base, modo: "Aéreo", puertoOrigenId: null })).toBeNull();
  });
});

const fila = (o: Partial<FilaCostoLocal>): FilaCostoLocal => ({
  concepto: "Flete marítimo", moneda: "USD", proveedor: "Maersk", cantidad: 1,
  costo_unitario: 3200, precio_venta: 3680, unidad_medida: "Contenedor", ...o,
});

describe("P1-4 · edición manual corta el linaje", () => {
  it("anula costeo_tarifa_id/recargo y conserva el origen en la nota", () => {
    const e = marcarEditadaAMano(fila({ notas: NOTA_AUTO_TARIFA, costeo_tarifa_id: "t1", costeo_tarifa_recargo_id: "r1", costo_unitario: 3000 }));
    expect(e.costeo_tarifa_id).toBeNull();
    expect(e.costeo_tarifa_recargo_id).toBeNull();
    expect(e.notas).toContain(NOTA_AUTO_TARIFA);
    // Revalidación: la fila editada ya no es heredada de la tarifa.
    expect(costosAutoDeOtraTarifa([e], "t2")).toHaveLength(0);
  });
  it("fila manual no se toca", () => {
    const m = fila({ notas: "Maniobras", costeo_tarifa_id: null });
    expect(marcarEditadaAMano(m)).toBe(m);
  });
});

describe("P1-3 / P2-5 · filas automáticas de otra tarifa", () => {
  const filas = [
    fila({ notas: NOTA_AUTO_TARIFA, costeo_tarifa_id: "A" }),
    fila({ concepto: "Maniobras", notas: "", costeo_tarifa_id: null }),
    fila({ notas: NOTA_AUTO_TARIFA, costeo_tarifa_id: null }), // legacy sin linaje
  ];
  it("detecta las de la tarifa anterior (cambio o quitar)", () => {
    expect(costosAutoDeOtraTarifa(filas, "B")).toHaveLength(1);
    expect(costosAutoDeOtraTarifa(filas, null)).toHaveLength(1);
    expect(costosAutoDeOtraTarifa(filas, "A")).toHaveLength(0);
  });
  it("conservar como manuales no borra nada y quita el linaje", () => {
    const r = conservarComoManuales(filas, null);
    expect(r).toHaveLength(3);
    expect(costosAutoDeOtraTarifa(r, null)).toHaveLength(0);
    expect(r[1]).toBe(filas[1]);
  });
});
