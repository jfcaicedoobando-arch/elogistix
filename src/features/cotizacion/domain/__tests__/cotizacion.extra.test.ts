import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildConceptosFromCostos,
  filtrarCostosParaContenedor,
  mapCostosACostosEmbarque,
  calcularFechaVigencia,
  type CotizacionCostoLike,
} from "@/features/cotizacion/domain/cotizacion";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const TASA = 0.16;

const mkFila = (over: Partial<FilaCostoLocal> = {}): FilaCostoLocal => ({
  concepto: "Flete",
  moneda: "USD",
  proveedor: "DHL",
  cantidad: 1,
  costo_unitario: 100,
  precio_venta: 200,
  unidad_medida: "Contenedor",
  ...over,
});

describe("cotizacion.extra — buildConceptosFromCostos extra cases", () => {
  it("concepto Handling en USD recibe aplica_iva=true", () => {
    const out = buildConceptosFromCostos([mkFila({ concepto: "Handling" })], TASA);
    expect(out.usd[0].aplica_iva).toBe(true);
  });

  it("concepto Handling en USD calcula total con IVA", () => {
    const out = buildConceptosFromCostos(
      [mkFila({ concepto: "Handling", cantidad: 1, precio_venta: 100 })],
      TASA,
    );
    expect(out.usd[0].total).toBeCloseTo(116, 2);
  });

  it("concepto genérico USD no lleva IVA y total = cantidad × precio_venta", () => {
    const out = buildConceptosFromCostos([mkFila({ concepto: "Flete", cantidad: 2, precio_venta: 150 })], TASA);
    expect(out.usd[0].aplica_iva).toBe(false);
    expect(out.usd[0].total).toBe(300);
  });

  it("tasa 0% → MXN total = subtotal sin IVA", () => {
    const out = buildConceptosFromCostos(
      [mkFila({ moneda: "MXN", concepto: "Maniobras", precio_venta: 500, cantidad: 2 })],
      0,
    );
    expect(out.mxn[0].total).toBe(1000);
  });

  it("múltiples filas MXN generan múltiples conceptos", () => {
    const out = buildConceptosFromCostos(
      [mkFila({ moneda: "MXN", concepto: "A" }), mkFila({ moneda: "MXN", concepto: "B" })],
      TASA,
    );
    expect(out.mxn).toHaveLength(2);
  });

  it("precio_unitario en resultado USD coincide con precio_venta", () => {
    const out = buildConceptosFromCostos([mkFila({ precio_venta: 350 })], TASA);
    expect(out.usd[0].precio_unitario).toBe(350);
  });
});

describe("cotizacion.extra — filtrarCostosParaContenedor extra cases", () => {
  const costos: CotizacionCostoLike[] = [
    { concepto: "Flete", unidad_medida: "Contenedor", costo_unitario: 100, moneda: "USD" },
    { concepto: "BL Fee", unidad_medida: "BL", costo_unitario: 50, moneda: "USD" },
    { concepto: "Bulto", unidad_medida: "Bulto", costo_unitario: 20, moneda: "MXN" },
  ];

  it("index=0 incluye BL", () => {
    expect(filtrarCostosParaContenedor(costos, 0).some((c) => c.unidad_medida === "BL")).toBe(true);
  });

  it("index=1 excluye BL", () => {
    expect(filtrarCostosParaContenedor(costos, 1).some((c) => c.unidad_medida === "BL")).toBe(false);
  });

  it("Contenedor presente en todos los índices", () => {
    [0, 1, 2].forEach((i) => {
      expect(filtrarCostosParaContenedor(costos, i).some((c) => c.concepto === "Flete")).toBe(true);
    });
  });

  it("unidad_medida null se trata como Contenedor (aparece en todos)", () => {
    const c: CotizacionCostoLike[] = [{ concepto: "X", unidad_medida: null, costo_unitario: 0, moneda: "USD" }];
    expect(filtrarCostosParaContenedor(c, 5)).toHaveLength(1);
  });
});

describe("cotizacion.extra — mapCostosACostosEmbarque extra cases", () => {
  it("mapea embarque_id a cada fila", () => {
    const costos: CotizacionCostoLike[] = [
      { concepto: "Flete", costo_unitario: 100, moneda: "USD" },
      { concepto: "Seguro", costo_unitario: 50, moneda: "MXN" },
    ];
    expect(mapCostosACostosEmbarque(costos, "EMB-999").every((r) => r.embarque_id === "EMB-999")).toBe(true);
  });

  it("proveedor undefined → proveedor_nombre null", () => {
    const costos: CotizacionCostoLike[] = [{ concepto: "X", costo_unitario: 0, moneda: "USD" }];
    expect(mapCostosACostosEmbarque(costos, "e1")[0].proveedor_nombre).toBeNull();
  });

  it("proveedor string se preserva", () => {
    const costos: CotizacionCostoLike[] = [{ concepto: "X", costo_unitario: 0, moneda: "USD", proveedor: "FedEx" }];
    expect(mapCostosACostosEmbarque(costos, "e1")[0].proveedor_nombre).toBe("FedEx");
  });

  it("lista vacía → array vacío", () => {
    expect(mapCostosACostosEmbarque([], "e1")).toHaveLength(0);
  });
});

describe("cotizacion.extra — calcularFechaVigencia extra cases", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-06-13T12:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("default 15 días desde fecha base fija", () => {
    expect(calcularFechaVigencia(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-16");
  });

  it("vigenciaDias null → usa 15 días", () => {
    expect(calcularFechaVigencia(new Date("2026-03-01T00:00:00Z"), null)).toBe("2026-03-16");
  });

  it("vigenciaDias 30 → 30 días después", () => {
    expect(calcularFechaVigencia(new Date("2026-01-01T00:00:00Z"), 30)).toBe("2026-01-31");
  });

  it("vigenciaDias 0 → misma fecha", () => {
    expect(calcularFechaVigencia(new Date("2026-06-01T00:00:00Z"), 0)).toBe("2026-06-01");
  });

  it("resultado en formato YYYY-MM-DD", () => {
    expect(calcularFechaVigencia(new Date("2026-06-13T12:00:00Z"), 15)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
