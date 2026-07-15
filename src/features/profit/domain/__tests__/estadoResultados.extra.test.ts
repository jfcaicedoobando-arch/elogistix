import { describe, it, expect } from "vitest";
import {
  buildEstadoResultados,
  MODOS_COLUMNAS,
  type EmbarqueER,
  type ConceptoVentaER,
  type ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const emb = (
  id: string,
  modo: string,
  tcUSD = 17,
  tcEUR = 18,
): EmbarqueER => ({ id, modo, tipo_cambio_usd: tcUSD, tipo_cambio_eur: tcEUR });

const venta = (
  embarque_id: string,
  descripcion: string,
  total: number,
  moneda = "MXN",
): ConceptoVentaER => ({ embarque_id, descripcion, total, moneda });

const costo = (
  embarque_id: string,
  concepto: string,
  monto: number,
  moneda = "MXN",
): ConceptoCostoER => ({ embarque_id, concepto, monto, moneda });

describe("estadoResultados.extra", () => {
  it("buildEstadoResultados: resultado vacío con inputs vacíos", () => {
    const er = buildEstadoResultados([], [], []);
    expect(er.ingresos).toHaveLength(0);
    expect(er.costos).toHaveLength(0);
    expect(er.totalIngresos.total).toBe(0);
    expect(er.totalCostos.total).toBe(0);
    expect(er.utilidad.total).toBe(0);
  });

  it("buildEstadoResultados: MODOS_COLUMNAS incluye Marítimo/Aéreo/Terrestre/Otros", () => {
    expect(MODOS_COLUMNAS).toHaveLength(4);
    expect(MODOS_COLUMNAS).toContain("Marítimo");
    expect(MODOS_COLUMNAS).toContain("Aéreo");
    expect(MODOS_COLUMNAS).toContain("Terrestre");
    expect(MODOS_COLUMNAS).toContain("Otros");
  });

  it("buildEstadoResultados: ingreso MXN se refleja en totalIngresos", () => {
    const embarques = [emb("e1", "Marítimo")];
    const ventas = [venta("e1", "Flete", 1000, "MXN")];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.totalIngresos.total).toBeCloseTo(1000);
    expect(er.totalIngresos.porModo["Marítimo"]).toBeCloseTo(1000);
    expect(er.totalIngresos.porModo["Aéreo"]).toBe(0);
  });

  it("buildEstadoResultados: ingreso USD se convierte con tipo de cambio", () => {
    const embarques = [emb("e1", "Aéreo", 20, 22)];
    const ventas = [venta("e1", "Handling", 100, "USD")];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.totalIngresos.porModo["Aéreo"]).toBeCloseTo(2000); // 100 * 20
  });

  it("buildEstadoResultados: costo MXN se refleja en totalCostos", () => {
    const embarques = [emb("e1", "Terrestre")];
    const costos = [costo("e1", "Aduana", 500, "MXN")];
    const er = buildEstadoResultados(embarques, [], costos);
    expect(er.totalCostos.porModo["Terrestre"]).toBeCloseTo(500);
  });

  it("buildEstadoResultados: utilidad = ingresos - costos", () => {
    const embarques = [emb("e1", "Marítimo")];
    const ventas = [venta("e1", "Flete", 5000)];
    const costos = [costo("e1", "Agente", 2000)];
    const er = buildEstadoResultados(embarques, ventas, costos);
    expect(er.utilidad.total).toBeCloseTo(3000);
  });

  it("buildEstadoResultados: conceptos con mismo nombre se acumulan en una sola fila", () => {
    const embarques = [emb("e1", "Marítimo"), emb("e2", "Marítimo")];
    const ventas = [
      venta("e1", "Flete", 1000),
      venta("e2", "Flete", 500),
    ];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.ingresos).toHaveLength(1);
    expect(er.ingresos[0].concepto).toBe("Flete");
    expect(er.ingresos[0].porModo["Marítimo"]).toBeCloseTo(1500);
  });

  it("buildEstadoResultados: embarque con modo desconocido cae a columna 'Otros'", () => {
    const embarques = [emb("e1", "Ferroviario" as string)];
    const ventas = [venta("e1", "Flete", 9999)];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.totalIngresos.total).toBe(9999);
    expect(er.totalIngresos.porModo["Otros"]).toBe(9999);
    expect(er.ingresos).toHaveLength(1);
  });

  it("buildEstadoResultados: margen es 0 cuando ingresos son 0", () => {
    const er = buildEstadoResultados([], [], []);
    expect(er.margen.total).toBe(0);
  });

  it("buildEstadoResultados: fila en cero en todas las columnas no aparece", () => {
    const embarques = [emb("e1", "Marítimo")];
    const ventas = [venta("e1", "Cero", 0)];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.ingresos).toHaveLength(0);
  });

  it("buildEstadoResultados: ingresos se ordenan de mayor a menor total", () => {
    const embarques = [emb("e1", "Marítimo")];
    const ventas = [
      venta("e1", "Menor", 100),
      venta("e1", "Mayor", 5000),
    ];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.ingresos[0].concepto).toBe("Mayor");
    expect(er.ingresos[1].concepto).toBe("Menor");
  });

  it("buildEstadoResultados: venta con embarque_id inexistente se ignora", () => {
    const embarques = [emb("e1", "Marítimo")];
    const ventas = [venta("GHOST", "Flete", 9999)];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.totalIngresos.total).toBe(0);
  });

  it("colapsa filas por acento y espacios en el pivot (fix ingresos duplicados)", () => {
    const embarques = [emb("e1", "Marítimo")];
    const ventas = [
      venta("e1", "Flete Marítimo", 100),
      venta("e1", "Flete Maritimo", 200), // sin acento
      venta("e1", "  Flete Marítimo  ", 300), // padding
      venta("e1", "FLETE  MARÍTIMO", 400), // mayúsculas + doble espacio
    ];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.ingresos).toHaveLength(1);
    expect(er.ingresos[0].total).toBe(1000);
  });

  it("asigna a columna 'Otros' modos no reconocidos (Multimodal, vacío)", () => {
    const embarques = [emb("e1", "Multimodal"), emb("e2", "")];
    const ventas = [venta("e1", "Flete", 500), venta("e2", "Flete", 300)];
    const er = buildEstadoResultados(embarques, ventas, []);
    expect(er.totalIngresos.porModo["Otros"]).toBe(800);
    expect(er.totalIngresos.total).toBe(800); // ya NO se pierden
    expect(MODOS_COLUMNAS).toContain("Otros" as const);
  });
});

