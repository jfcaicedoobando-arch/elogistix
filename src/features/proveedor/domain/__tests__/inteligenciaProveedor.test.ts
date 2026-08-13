import { describe, expect, it } from "vitest";
import {
  calcularDesviacion,
  clasificarComparativo,
  construirAlertas,
  MIN_OPS_COMPARATIVO,
  pctPartidasFacturadas,
  semaforoDiasFacturacion,
  type AlertasProveedor,
  type ComparativoConcepto,
} from "../inteligenciaProveedor";

describe("semaforoDiasFacturacion", () => {
  it("es neutral cuando no hay facturas ligadas", () => {
    expect(semaforoDiasFacturacion(null)).toBe("neutral");
  });

  it("aplica los cortes 7 y 20 días", () => {
    expect(semaforoDiasFacturacion(0)).toBe("good");
    expect(semaforoDiasFacturacion(7)).toBe("good");
    expect(semaforoDiasFacturacion(7.5)).toBe("warn");
    expect(semaforoDiasFacturacion(20)).toBe("warn");
    expect(semaforoDiasFacturacion(21)).toBe("bad");
  });
});

describe("calcularDesviacion", () => {
  it("compara solo contra lo comprometido que ya tiene factura", () => {
    const d = calcularDesviacion({ comprometidoLigadoMxn: 1000, facturadoMxn: 1100 });
    expect(d.montoMxn).toBe(100);
    expect(d.pct).toBe(10);
    expect(d.factutaDeMas).toBe(true);
    expect(d.semaforo).toBe("warn");
  });

  it("marca bien una desviación menor al 2%", () => {
    expect(calcularDesviacion({ comprometidoLigadoMxn: 1000, facturadoMxn: 1015 }).semaforo).toBe("good");
  });

  it("marca mal una desviación mayor al 10%, aunque sea a la baja", () => {
    const d = calcularDesviacion({ comprometidoLigadoMxn: 1000, facturadoMxn: 800 });
    expect(d.pct).toBe(-20);
    expect(d.semaforo).toBe("bad");
    expect(d.factutaDeMas).toBe(false);
  });

  it("no divide entre cero cuando no hay base comprometida", () => {
    const d = calcularDesviacion({ comprometidoLigadoMxn: 0, facturadoMxn: 500 });
    expect(d.pct).toBeNull();
    expect(d.semaforo).toBe("neutral");
  });
});

describe("pctPartidasFacturadas", () => {
  it("calcula la cobertura de facturación", () => {
    expect(pctPartidasFacturadas({ partidasTotal: 142, partidasFacturadas: 67 })).toBe(47.2);
  });

  it("devuelve null sin partidas", () => {
    expect(pctPartidasFacturadas({ partidasTotal: 0, partidasFacturadas: 0 })).toBeNull();
  });
});

const fila = (over: Partial<ComparativoConcepto>): ComparativoConcepto => ({
  concepto: "Flete", moneda: "USD", unitarioPropio: 100, opsPropias: 5,
  unitarioOtros: 100, opsOtros: 5, proveedoresComparados: 2, ...over,
});

describe("clasificarComparativo", () => {
  it("descarta comparaciones sin muestra suficiente en cualquiera de los dos lados", () => {
    const r = clasificarComparativo([
      fila({ concepto: "A", opsPropias: MIN_OPS_COMPARATIVO - 1 }),
      fila({ concepto: "B", opsOtros: MIN_OPS_COMPARATIVO - 1 }),
    ]);
    expect(r).toHaveLength(0);
  });

  it("descarta cuando el promedio de los demás es cero", () => {
    expect(clasificarComparativo([fila({ unitarioOtros: 0 })])).toHaveLength(0);
  });

  it("clasifica más caro, en línea y más barato con corte de 5%", () => {
    const r = clasificarComparativo([
      fila({ concepto: "Caro", unitarioPropio: 120 }),
      fila({ concepto: "Igual", unitarioPropio: 103 }),
      fila({ concepto: "Barato", unitarioPropio: 80 }),
    ]);
    expect(r.map((x) => x.veredicto)).toEqual(["mas_caro", "en_linea", "mas_barato"]);
    expect(r[0].diffPct).toBe(20);
  });

  it("ordena de más caro a más barato", () => {
    const r = clasificarComparativo([
      fila({ concepto: "Barato", unitarioPropio: 70 }),
      fila({ concepto: "Caro", unitarioPropio: 150 }),
    ]);
    expect(r.map((x) => x.concepto)).toEqual(["Caro", "Barato"]);
  });
});

const alertasVacias: AlertasProveedor = {
  cerradosSinFactura: { count: 0, montoMxn: 0 },
  facturasPorVencer: { count: 0, montoMxn: 0 },
  facturasVencidas: { count: 0, montoMxn: 0 },
  saldoPendienteMxn: 0,
  bancariosIncompletos: false,
  documentosVencidos: 0,
  documentosPorVencer: 0,
};

describe("construirAlertas", () => {
  it("no genera alertas cuando todo está al día", () => {
    expect(construirAlertas(alertasVacias)).toEqual([]);
  });

  it("ordena por severidad: críticas, medias y luego informativas", () => {
    const r = construirAlertas({
      ...alertasVacias,
      documentosPorVencer: 1,
      cerradosSinFactura: { count: 4, montoMxn: 1000 },
      facturasVencidas: { count: 2, montoMxn: 500 },
    });
    expect(r.map((a) => a.id)).toEqual(["vencidas", "cerrados_sin_factura", "docs_por_vencer"]);
  });

  it("solo alerta de datos bancarios cuando hay saldo por pagar", () => {
    expect(construirAlertas({ ...alertasVacias, bancariosIncompletos: true })).toEqual([]);
    const r = construirAlertas({ ...alertasVacias, bancariosIncompletos: true, saldoPendienteMxn: 900 });
    expect(r[0]).toMatchObject({ id: "bancarios", severidad: "critica", montoMxn: 900 });
  });

  it("usa singular y plural en español", () => {
    const uno = construirAlertas({ ...alertasVacias, facturasVencidas: { count: 1, montoMxn: 10 } });
    expect(uno[0].titulo).toBe("1 factura vencida");
    const dos = construirAlertas({ ...alertasVacias, facturasVencidas: { count: 2, montoMxn: 10 } });
    expect(dos[0].titulo).toBe("2 facturas vencidas");
  });
});
