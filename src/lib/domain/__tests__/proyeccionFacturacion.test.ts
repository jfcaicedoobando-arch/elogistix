import { describe, it, expect } from "vitest";
import {
  sumarConceptosEnMxn,
  sumarConceptosEnUsd,
  agruparPorExpediente,
  calcularKpisProyeccion,
  rangoMes,
  generarMesesDisponibles,
  mesActualKey,
  type FilaProyeccion,
} from "../proyeccionFacturacion";

const TC_USD = 20;
const TC_EUR = 22;

describe("sumarConceptosEnMxn", () => {
  it("convierte USD/EUR/MXN al TC del embarque", () => {
    const total = sumarConceptosEnMxn(
      [
        { monto: 100, moneda: "USD" },
        { monto: 100, moneda: "EUR" },
        { monto: 100, moneda: "MXN" },
      ],
      TC_USD,
      TC_EUR,
    );
    expect(total).toBe(100 * TC_USD + 100 * TC_EUR + 100);
  });

  it("usa MXN cuando la moneda viene vacía", () => {
    expect(sumarConceptosEnMxn([{ monto: 50, moneda: "" }], TC_USD, TC_EUR)).toBe(50);
  });
});

describe("sumarConceptosEnUsd", () => {
  it("USD se suma directo, MXN se divide por TC, EUR se cruza", () => {
    const total = sumarConceptosEnUsd(
      [
        { monto: 100, moneda: "USD" },
        { monto: 200, moneda: "MXN" },
        { monto: 100, moneda: "EUR" },
      ],
      TC_USD,
      TC_EUR,
    );
    expect(total).toBeCloseTo(100 + 200 / TC_USD + (100 * TC_EUR) / TC_USD);
  });

  it("retorna 0 si TC USD es inválido", () => {
    expect(sumarConceptosEnUsd([{ monto: 100, moneda: "MXN" }], 0, TC_EUR)).toBe(0);
  });
});

const fila = (over: Partial<FilaProyeccion>): FilaProyeccion => ({
  embarque_id: "e1",
  expediente: "EXP-001",
  cliente_nombre: "Acme",
  operador: "Op1",
  eta: "2026-04-15",
  contenedor: "MSCU1234567",
  tipo_cambio_usd: TC_USD,
  tipo_cambio_eur: TC_EUR,
  tiene_proforma: true,
  tiene_factura_pdf: true,
  venta_mxn: 1000,
  venta_usd: 50,
  costo_mxn: 600,
  costo_usd: 30,
  ...over,
});

describe("agruparPorExpediente", () => {
  it("agrupa varios embarques del mismo expediente y suma totales", () => {
    const grupos = agruparPorExpediente([
      fila({ embarque_id: "e1" }),
      fila({ embarque_id: "e2", contenedor: "MSCU0000002", venta_mxn: 500, costo_mxn: 200 }),
    ]);
    expect(grupos).toHaveLength(1);
    const g = grupos[0];
    expect(g.expediente).toBe("EXP-001");
    expect(g.embarqueIds).toEqual(["e1", "e2"]);
    expect(g.ventaMxn).toBe(1500);
    expect(g.costoMxn).toBe(800);
    expect(g.profitMxn).toBe(700);
    expect(g.contenedores).toEqual(["MSCU1234567", "MSCU0000002"]);
  });

  it("estado pasa a Pendiente si CUALQUIER embarque del grupo no está facturado", () => {
    const grupos = agruparPorExpediente([
      fila({ embarque_id: "e1" }),
      fila({ embarque_id: "e2", tiene_factura_pdf: false }),
    ]);
    expect(grupos[0].estado).toBe("Pendiente");
  });

  it("estado Facturado solo si todos cumplen proforma + pdf", () => {
    const grupos = agruparPorExpediente([fila({})]);
    expect(grupos[0].estado).toBe("Facturado");
  });

  it("ordena por ETA ascendente", () => {
    const grupos = agruparPorExpediente([
      fila({ embarque_id: "a", expediente: "B", eta: "2026-05-10" }),
      fila({ embarque_id: "b", expediente: "A", eta: "2026-04-01" }),
    ]);
    expect(grupos.map((g) => g.expediente)).toEqual(["A", "B"]);
  });

  it("toma la ETA mínima del grupo", () => {
    const grupos = agruparPorExpediente([
      fila({ embarque_id: "e1", eta: "2026-04-20" }),
      fila({ embarque_id: "e2", eta: "2026-04-05" }),
    ]);
    expect(grupos[0].eta).toBe("2026-04-05");
  });
});

describe("calcularKpisProyeccion", () => {
  it("calcula totales, márgenes y avance de facturación", () => {
    const grupos = agruparPorExpediente([
      fila({ embarque_id: "e1", expediente: "A" }), // facturado
      fila({
        embarque_id: "e2",
        expediente: "B",
        tiene_factura_pdf: false,
        venta_mxn: 2000,
        costo_mxn: 1000,
        venta_usd: 100,
        costo_usd: 50,
      }), // pendiente
    ]);
    const k = calcularKpisProyeccion(grupos);
    expect(k.totalExpedientes).toBe(2);
    expect(k.facturados).toBe(1);
    expect(k.pendientes).toBe(1);
    expect(k.ventaProyMxn).toBe(3000);
    expect(k.ventaFacturadaMxn).toBe(1000);
    expect(k.ventaPendienteMxn).toBe(2000);
    expect(k.costoTotalMxn).toBe(1600);
    expect(k.profitProyMxn).toBe(1400);
    expect(k.avancePct).toBe(50);
    expect(k.margenProyPct).toBeCloseTo((1400 / 3000) * 100);
  });

  it("evita división por cero cuando no hay venta", () => {
    expect(calcularKpisProyeccion([]).margenProyPct).toBe(0);
    expect(calcularKpisProyeccion([]).avancePct).toBe(0);
  });
});

describe("rangoMes", () => {
  it("devuelve primer y último día (incluyendo años bisiestos)", () => {
    expect(rangoMes(2026, 4)).toEqual({ desde: "2026-04-01", hasta: "2026-04-30" });
    expect(rangoMes(2024, 2)).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
    expect(rangoMes(2025, 12)).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
  });
});

describe("generarMesesDisponibles", () => {
  it("arranca en abril 2026 y se extiende ~12 meses adelante", () => {
    const meses = generarMesesDisponibles(new Date(2026, 5, 15));
    expect(meses[0].key).toBe("2026-04");
    expect(meses.length).toBeGreaterThanOrEqual(12);
  });
});

describe("mesActualKey", () => {
  it("nunca regresa antes de abril 2026", () => {
    expect(mesActualKey(new Date(2025, 0, 1))).toBe("2026-04");
  });
  it("respeta la fecha cuando es posterior", () => {
    expect(mesActualKey(new Date(2026, 6, 10))).toBe("2026-07");
  });
});
