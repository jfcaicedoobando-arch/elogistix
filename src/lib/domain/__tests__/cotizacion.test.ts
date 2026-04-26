import { describe, it, expect } from "vitest";
import {
  buildConceptosFromCostos,
  filtrarCostosParaContenedor,
  mapCostosACostosEmbarque,
  calcularFechaVigencia,
  type CotizacionCostoLike,
} from "@/lib/domain/cotizacion";
import type { FilaCostoLocal } from "@/types/cotizacionPL";

const TASA = 0.16;

const fila = (over: Partial<FilaCostoLocal>): FilaCostoLocal => ({
  concepto: "Flete Marítimo",
  moneda: "USD",
  proveedor: "",
  cantidad: 1,
  costo_unitario: 100,
  precio_venta: 200,
  unidad_medida: "Contenedor",
  ...over,
});

describe("buildConceptosFromCostos", () => {
  it("descarta conceptos con descripción vacía", () => {
    const out = buildConceptosFromCostos([fila({ concepto: "  " })], TASA);
    expect(out.usd).toHaveLength(0);
    expect(out.mxn).toHaveLength(0);
  });

  it("separa por moneda", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD" }), fila({ moneda: "MXN", concepto: "Maniobras" })],
      TASA,
    );
    expect(out.usd).toHaveLength(1);
    expect(out.mxn).toHaveLength(1);
    expect(out.usd[0].moneda).toBe("USD");
    expect(out.mxn[0].moneda).toBe("MXN");
  });

  it("aplica IVA siempre a MXN", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "MXN", concepto: "Maniobras", precio_venta: 1000, cantidad: 1 })],
      TASA,
    );
    expect(out.mxn[0].aplica_iva).toBe(true);
    expect(out.mxn[0].total).toBeCloseTo(1160, 2);
  });

  it("USD sin IVA si el concepto no está en CONCEPTOS_CON_IVA_USD", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD", concepto: "Flete Marítimo", precio_venta: 100, cantidad: 2 })],
      TASA,
    );
    expect(out.usd[0].aplica_iva).toBe(false);
    expect(out.usd[0].total).toBe(200);
  });

  it("USD con IVA si el concepto está en CONCEPTOS_CON_IVA_USD (Handling)", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD", concepto: "Handling", precio_venta: 100, cantidad: 1 })],
      TASA,
    );
    expect(out.usd[0].aplica_iva).toBe(true);
    expect(out.usd[0].total).toBeCloseTo(116, 2);
  });

  it("preserva unidad_medida y cantidad en la salida", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD", concepto: "Flete Marítimo", unidad_medida: "BL", cantidad: 3 })],
      TASA,
    );
    expect(out.usd[0].unidad_medida).toBe("BL");
    expect(out.usd[0].cantidad).toBe(3);
  });
});

describe("filtrarCostosParaContenedor", () => {
  const costos = [
    { concepto: "Flete", unidad_medida: "Contenedor" },
    { concepto: "BL fee", unidad_medida: "BL" },
    { concepto: "Maniobras", unidad_medida: "Bulto" },
    { concepto: "Sin UM", unidad_medida: null },
  ];

  it("incluye costos BL solo en el primer contenedor (i=0)", () => {
    const out = filtrarCostosParaContenedor(costos, 0);
    expect(out.map((c) => c.concepto)).toEqual([
      "Flete",
      "BL fee",
      "Maniobras",
      "Sin UM",
    ]);
  });

  it("excluye costos BL en contenedores posteriores (i>0)", () => {
    const out = filtrarCostosParaContenedor(costos, 1);
    expect(out.map((c) => c.concepto)).toEqual(["Flete", "Maniobras", "Sin UM"]);
  });

  it("trata unidad_medida null como 'Contenedor' (siempre incluido)", () => {
    const out = filtrarCostosParaContenedor(
      [{ concepto: "X", unidad_medida: null }],
      5,
    );
    expect(out).toHaveLength(1);
  });
});

describe("mapCostosACostosEmbarque", () => {
  const costos: CotizacionCostoLike[] = [
    {
      concepto: "Flete",
      costo_unitario: 1500,
      moneda: "USD",
      proveedor: "Maersk",
    },
    {
      concepto: "Maniobras",
      costo_unitario: 800,
      moneda: "MXN",
      proveedor: null,
    },
  ];

  it("mapea costos a inserts de conceptos_costo con embarque_id", () => {
    const out = mapCostosACostosEmbarque(costos, "emb-1");
    expect(out).toEqual([
      {
        embarque_id: "emb-1",
        concepto: "Flete",
        monto: 1500,
        moneda: "USD",
        proveedor_nombre: "Maersk",
      },
      {
        embarque_id: "emb-1",
        concepto: "Maniobras",
        monto: 800,
        moneda: "MXN",
        proveedor_nombre: null,
      },
    ]);
  });

  it("convierte proveedor undefined en null", () => {
    const out = mapCostosACostosEmbarque(
      [{ concepto: "X", costo_unitario: 10, moneda: "USD" }],
      "emb-9",
    );
    expect(out[0].proveedor_nombre).toBeNull();
  });
});

describe("calcularFechaVigencia", () => {
  it("suma vigenciaDias a la fecha base y devuelve YYYY-MM-DD", () => {
    const base = new Date("2026-01-10T00:00:00Z");
    expect(calcularFechaVigencia(base, 15)).toBe("2026-01-25");
  });

  it("usa default de 15 días cuando vigenciaDias es null", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    expect(calcularFechaVigencia(base, null)).toBe("2026-01-16");
  });

  it("usa default de 15 días cuando vigenciaDias es undefined", () => {
    const base = new Date("2026-02-01T00:00:00Z");
    expect(calcularFechaVigencia(base, undefined)).toBe("2026-02-16");
  });

  it("acepta vigencias de 0 días (mismo día)", () => {
    const base = new Date("2026-03-15T00:00:00Z");
    expect(calcularFechaVigencia(base, 0)).toBe("2026-03-15");
  });
});
