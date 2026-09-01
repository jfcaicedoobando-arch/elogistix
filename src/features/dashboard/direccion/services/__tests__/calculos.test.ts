import { describe, it, expect } from "vitest";
import {
  agregarEmbarques,
  calcularMargen6m,
  calcularMargenPorModo,
  calcularTopClientes,
  calcularAntiguedad,
  calcularHero,
  calcularPulso,
  type EmbarqueAgg,
} from "../calculos";
import type {
  EmbarqueRow, FacturaRow, EmbarqueEstadoRow,
} from "../loaders";

function embarque(over: Partial<EmbarqueRow> = {}): EmbarqueRow {
  return {
    id: "e1", modo: "Marítimo", estado: "Activo", eta: "2026-01-10",
    cerrado_at: null, cliente_id: "c1", cliente_nombre: "Cliente Uno",
    tipo_cambio_usd: 18, tipo_cambio_eur: 20,
    ...over,
  };
}

describe("agregarEmbarques", () => {
  it("ignora embarques sin cerrado_at ni eta", () => {
    const out = agregarEmbarques([embarque({ id: "e1", cerrado_at: null, eta: null })], [], []);
    expect(out).toHaveLength(0);
  });

  it("usa cerrado_at cuando existe, si no cae a eta", () => {
    const out = agregarEmbarques([embarque({ id: "e1", cerrado_at: "2026-02-01", eta: "2026-01-10" })], [], []);
    expect(out[0].mes).toBe("2026-02");
  });

  it("usa eta cuando no hay cerrado_at", () => {
    const out = agregarEmbarques([embarque({ id: "e1", cerrado_at: null, eta: "2026-03-05" })], [], []);
    expect(out[0].mes).toBe("2026-03");
  });

  it("aplica fallback 'Sin modo' y 'Sin cliente'", () => {
    const out = agregarEmbarques([embarque({ modo: null, cliente_nombre: null })], [], []);
    expect(out[0].modo).toBe("Sin modo");
    expect(out[0].cliente_nombre).toBe("Sin cliente");
  });

  it("TC inválido o <=0 se trata como 0 (no contamina)", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: -1, tipo_cambio_eur: NaN })],
      [{ embarque_id: "e1", total: 100, moneda: "USD" }],
      [],
    );
    // moneda != MXN y tc.usd <= 0 -> se ignora la venta
    expect(out[0].venta).toBe(0);
  });

  it("suma ventas MXN aunque no haya TC", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: 0, tipo_cambio_eur: 0 })],
      [{ embarque_id: "e1", total: 500, moneda: "MXN" }],
      [],
    );
    expect(out[0].venta).toBe(500);
  });

  it("ignora ventas/costos de embarques no incluidos en el mapa", () => {
    const out = agregarEmbarques(
      [embarque({ id: "e1" })],
      [{ embarque_id: "otro", total: 500, moneda: "MXN" }],
      [{ embarque_id: "otro", monto: 100, moneda: "MXN" }],
    );
    expect(out[0].venta).toBe(0);
    expect(out[0].costo).toBe(0);
  });

  it("suma costos en USD cuando hay TC válido", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: 20, tipo_cambio_eur: 0 })],
      [],
      [{ embarque_id: "e1", monto: 10, moneda: "USD" }],
    );
    expect(out[0].costo).toBe(200);
  });

  it("ignora costo en moneda no-MXN sin TC válido", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: 0 })],
      [],
      [{ embarque_id: "e1", monto: 10, moneda: "USD" }],
    );
    expect(out[0].costo).toBe(0);
  });
});

describe("calcularMargen6m", () => {
  it("genera 6 meses, con montos en cero si no hay datos", () => {
    const out = calcularMargen6m([], new Date(Date.UTC(2026, 5, 15)));
    expect(out).toHaveLength(6);
    expect(out[5].mes).toBe("2026-06");
    expect(out[0].mes).toBe("2026-01");
    expect(out[0].margen_pct).toBe(0);
  });

  it("calcula margen y utilidad para el mes correspondiente", () => {
    const aggs: EmbarqueAgg[] = [
      { venta: 1000, costo: 600, modo: "Marítimo", cliente_id: "c1", cliente_nombre: "A", mes: "2026-06" },
    ];
    const out = calcularMargen6m(aggs, new Date(Date.UTC(2026, 5, 15)));
    const junio = out.find((m) => m.mes === "2026-06")!;
    expect(junio.utilidad_mxn).toBe(400);
    expect(junio.margen_pct).toBeCloseTo(40);
  });
});

describe("calcularMargenPorModo", () => {
  it("agrupa por modo y ordena por venta descendente", () => {
    const aggs: EmbarqueAgg[] = [
      { venta: 100, costo: 50, modo: "Aéreo", cliente_id: null, cliente_nombre: "x", mes: "2026-01" },
      { venta: 500, costo: 200, modo: "Marítimo", cliente_id: null, cliente_nombre: "x", mes: "2026-01" },
      { venta: 50, costo: 20, modo: "Aéreo", cliente_id: null, cliente_nombre: "x", mes: "2026-01" },
    ];
    const out = calcularMargenPorModo(aggs);
    expect(out[0].modo).toBe("Marítimo");
    expect(out[1].modo).toBe("Aéreo");
    expect(out[1].venta_mxn).toBe(150);
  });

  it("devuelve arreglo vacío si no hay aggs", () => {
    expect(calcularMargenPorModo([])).toEqual([]);
  });
});

describe("calcularTopClientes", () => {
  it("agrupa por cliente_id cuando existe", () => {
    const aggs: EmbarqueAgg[] = [
      { venta: 100, costo: 50, modo: "m", cliente_id: "c1", cliente_nombre: "Uno", mes: "2026-01" },
      { venta: 200, costo: 50, modo: "m", cliente_id: "c1", cliente_nombre: "Uno", mes: "2026-01" },
    ];
    const out = calcularTopClientes(aggs);
    expect(out).toHaveLength(1);
    expect(out[0].utilidad_mxn).toBe(200);
    expect(out[0].pct).toBe(100);
  });

  it("agrupa por nombre cuando cliente_id es null", () => {
    const aggs: EmbarqueAgg[] = [
      { venta: 100, costo: 50, modo: "m", cliente_id: null, cliente_nombre: "Sin cliente", mes: "2026-01" },
      { venta: 100, costo: 50, modo: "m", cliente_id: null, cliente_nombre: "Otro", mes: "2026-01" },
    ];
    const out = calcularTopClientes(aggs);
    expect(out.find((x) => x.cliente_nombre === "Sin cliente")).toBeDefined();
    expect(out.find((x) => x.cliente_nombre === "Otro")).toBeDefined();
  });

  it("pct es 0 cuando totalPos es 0 (todas utilidades negativas)", () => {
    const aggs: EmbarqueAgg[] = [
      { venta: 10, costo: 100, modo: "m", cliente_id: "c1", cliente_nombre: "Uno", mes: "2026-01" },
    ];
    const out = calcularTopClientes(aggs);
    expect(out[0].pct).toBe(0);
  });

  it("limita a los top 5 clientes", () => {
    const aggs: EmbarqueAgg[] = Array.from({ length: 8 }, (_, i) => ({
      venta: (i + 1) * 100, costo: 0, modo: "m", cliente_id: `c${i}`, cliente_nombre: `C${i}`, mes: "2026-01",
    }));
    const out = calcularTopClientes(aggs);
    expect(out).toHaveLength(5);
    expect(out[0].cliente_id).toBe("c7");
  });
});

function factura(over: Partial<FacturaRow> = {}): FacturaRow {
  return {
    id: "f1", total: 1000, moneda: "MXN", tipo_cambio: null,
    fecha_emision: "2026-01-01", fecha_vencimiento: "2026-01-15", estado: "Pendiente",
    cliente_id: "c1", timbrado_en: "2026-01-01", uuid_fiscal: "uuid-1",
    acuse_cancelacion_status: null,
    ...over,
  };
}

describe("calcularAntiguedad", () => {
  const hoy = new Date(Date.UTC(2026, 1, 1)); // 2026-02-01

  it("ignora facturas canceladas", () => {
    const out = calcularAntiguedad([factura({ estado: "Cancelada" })], [], { usd: 18 }, hoy);
    expect(out.every((b) => b.facturas === 0)).toBe(true);
  });

  it("resta pagos aplicados del saldo", () => {
    const out = calcularAntiguedad(
      [factura({ id: "f1", total: 1000, fecha_vencimiento: "2026-01-01" })],
      [{ factura_id: "f1", monto_aplicado_factura: 1000, moneda: "MXN", tipo_cambio: null, fecha_pago: "2026-01-05" }],
      { usd: 18 }, hoy,
    );
    // saldo <= 0.5 -> se ignora
    expect(out.reduce((s, b) => s + b.facturas, 0)).toBe(0);
  });

  it("ignora pagos de facturas no existentes en el mapa de saldo", () => {
    const out = calcularAntiguedad(
      [factura({ id: "f1", estado: "Cancelada" })],
      [{ factura_id: "f-inexistente", monto_aplicado_factura: 10, moneda: "MXN", tipo_cambio: null, fecha_pago: "2026-01-05" }],
      { usd: 18 }, hoy,
    );
    expect(out.reduce((s, b) => s + b.facturas, 0)).toBe(0);
  });

  it("clasifica bucket Corriente cuando dias <= 0", () => {
    const out = calcularAntiguedad([factura({ fecha_vencimiento: "2026-02-10" })], [], { usd: 18 }, hoy);
    const corriente = out.find((b) => b.bucket === "Corriente")!;
    expect(corriente.facturas).toBe(1);
  });

  it("clasifica bucket 1-30", () => {
    const out = calcularAntiguedad([factura({ fecha_vencimiento: "2026-01-15" })], [], { usd: 18 }, hoy);
    const b = out.find((x) => x.bucket === "1-30")!;
    expect(b.facturas).toBe(1);
  });

  it("clasifica bucket 31-60", () => {
    const out = calcularAntiguedad([factura({ fecha_vencimiento: "2025-12-15" })], [], { usd: 18 }, hoy);
    const b = out.find((x) => x.bucket === "31-60")!;
    expect(b.facturas).toBe(1);
  });

  it("clasifica bucket +60", () => {
    const out = calcularAntiguedad([factura({ fecha_vencimiento: "2025-10-01" })], [], { usd: 18 }, hoy);
    const b = out.find((x) => x.bucket === "+60")!;
    expect(b.facturas).toBe(1);
  });

  it("usa hoy como venc cuando fecha_vencimiento es null", () => {
    const out = calcularAntiguedad([factura({ fecha_vencimiento: null })], [], { usd: 18 }, hoy);
    const corriente = out.find((b) => b.bucket === "Corriente")!;
    expect(corriente.facturas).toBe(1);
  });
});

describe("calcularHero", () => {
  const hoy = new Date(Date.UTC(2026, 1, 1));
  const aggs: EmbarqueAgg[] = [
    { venta: 1000, costo: 600, modo: "m", cliente_id: "c1", cliente_nombre: "A", mes: "2026-01" },
    { venta: 500, costo: 300, modo: "m", cliente_id: "c1", cliente_nombre: "A", mes: "2025-12" },
  ];

  it("calcula KPIs con facturas vencidas y facturado del mes", () => {
    const facturas: FacturaRow[] = [
      factura({ id: "f1", estado: "Pendiente", fecha_emision: "2026-01-05", fecha_vencimiento: "2026-01-01", cliente_id: "c1" }),
      factura({ id: "f2", estado: "Cancelada", fecha_emision: "2026-01-05", fecha_vencimiento: "2020-01-01" }),
      factura({ id: "f3", estado: "Pagada", fecha_emision: "2026-01-05", fecha_vencimiento: "2020-01-01" }),
      factura({ id: "f4", estado: "Pendiente", fecha_emision: "2026-01-05", fecha_vencimiento: null }),
    ];
    const out = calcularHero({
      aggs, facturas, facturasCartera: facturas, antiguedad: [
        { bucket: "Corriente", monto_mxn: 100, facturas: 1 },
        { bucket: "1-30", monto_mxn: 200, facturas: 1 },
      ], fallbacks: { usd: 18 }, hoy, mesActual: "2026-01", mesPrev: "2025-12",
    });
    expect(out.venta_mxn).toBe(1000);
    expect(out.costo_mxn).toBe(600);
    expect(out.margen_pct_prev).toBeCloseTo(40);
    expect(out.cartera_vencida_mxn).toBe(200);
    expect(out.cartera_vencida_clientes).toBe(1);
    expect(out.facturado_mes_mxn).toBe(1000 * 3);
  });

  it("no cuenta clientes null repetidos (filter Boolean)", () => {
    const facturas: FacturaRow[] = [
      factura({ id: "f1", estado: "Pendiente", fecha_vencimiento: "2020-01-01", cliente_id: null }),
    ];
    const out = calcularHero({
      aggs: [], facturas, facturasCartera: facturas, antiguedad: [], fallbacks: { usd: 18 }, hoy, mesActual: "2026-01", mesPrev: "2025-12",
    });
    expect(out.cartera_vencida_clientes).toBe(0);
  });

  it("P1-6: usa facturasCartera (sin ventana) para vencidas, no facturas (ventana 6m)", () => {
    // Factura pendiente de 7+ meses: ya no aparece en `facturas` (ventana de
    // tendencia), pero sí en `facturasCartera` (universo abierto sin filtro
    // de fecha). El hero debe reflejarla en cartera vencida sin contaminar
    // `facturado_mes_mxn`, que sólo mira `facturas`.
    const facturaVieja = factura({
      id: "f-vieja", estado: "Vencida", fecha_emision: "2025-06-01",
      fecha_vencimiento: "2025-06-15", cliente_id: "c-vieja",
    });
    const out = calcularHero({
      aggs: [], facturas: [], facturasCartera: [facturaVieja],
      antiguedad: [{ bucket: "+60", monto_mxn: 1000, facturas: 1 }],
      fallbacks: { usd: 18 }, hoy, mesActual: "2026-01", mesPrev: "2025-12",
    });
    expect(out.cartera_vencida_mxn).toBe(1000);
    expect(out.cartera_vencida_clientes).toBe(1);
    expect(out.facturado_mes_mxn).toBe(0);
  });
});

describe("calcularPulso", () => {
  // FE-04: los KPIs se calculan por DÍA LOCAL, así que el fixture usa mediodía
  // local (no UTC medianoche) para que el día no cambie según la zona del CI.
  const hoy = new Date(2026, 1, 1, 12, 0, 0);

  it("cuenta arribos en 7 días y demoras en aduana (Ola 4 · N21: demora sólo >7 días)", () => {
    const activos: EmbarqueEstadoRow[] = [
      // hoy = 2026-02-01. 2026-01-24 => 8 días de retraso: SÍ demora.
      { estado: "En Aduana", eta: "2026-01-24" },
      // 2026-01-25 => 7 días de retraso exactos: NO demora (límite inclusive).
      { estado: "En Aduana", eta: "2026-01-25" },
      { estado: "En Tránsito", eta: "2026-02-03" }, // dentro de 7 días
      { estado: "En Tránsito", eta: "2026-03-01" }, // fuera de rango
      { estado: null, eta: null }, // sin estado, sin eta
    ];
    const facturas: FacturaRow[] = [
      factura({ uuid_fiscal: "u1", timbrado_en: "2026-01-15" }),
      factura({ uuid_fiscal: null, timbrado_en: "2026-01-15" }),
      factura({ uuid_fiscal: "u2", timbrado_en: null }),
      factura({ uuid_fiscal: "u3", timbrado_en: "2025-12-15" }),
      factura({ estado: "Cancelada", acuse_cancelacion_status: null }),
      factura({ estado: "Cancelada", acuse_cancelacion_status: "aceptado" }),
    ];
    const out = calcularPulso(activos, facturas, hoy, "2026-01");
    expect(out.embarques_activos).toBe(5);
    expect(out.arribos_7d).toBe(1);
    expect(out.demoras).toBe(1);
    expect(out.cfdi_timbrados_mes).toBe(3);
    expect(out.acuses_pendientes).toBe(1);
    expect(out.documentos_vencidos).toBeNull();
    expect(out.embarques_por_estado.find((e) => e.estado === "Sin estado")).toBeDefined();
  });

  it("un arribo con ETA hoy SÍ cuenta en arribos_7d (Ola 4 · N21)", () => {
    const activos: EmbarqueEstadoRow[] = [
      { estado: "En Tránsito", eta: "2026-02-01" }, // ETA = hoy
    ];
    const out = calcularPulso(activos, [], new Date(Date.UTC(2026, 1, 1, 18, 30)), "2026-02");
    expect(out.arribos_7d).toBe(1);
  });

  it("ordena embarques_por_estado descendente por total", () => {
    const activos: EmbarqueEstadoRow[] = [
      { estado: "A", eta: null }, { estado: "B", eta: null }, { estado: "B", eta: null },
    ];
    const out = calcularPulso(activos, [], hoy, "2026-01");
    expect(out.embarques_por_estado[0].estado).toBe("B");
  });
});
