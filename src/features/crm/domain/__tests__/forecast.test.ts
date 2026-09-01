/**
 * Tests de la lógica pura del forecast/reportes del CRM (Sprint T1).
 * Cubre `computeForecast`, `computeReportesCRM`, `mesKey`, `mesLabel`.
 */
import { describe, it, expect } from "vitest";
import {
  computeForecast,
  computeReportesCRM,
  mesKey,
  mesLabel,
  type EtapaTipo,
  type OportunidadRow,
} from "@/features/crm/domain/forecast";

const etapaTipos = new Map<string, EtapaTipo>([
  ["abierta-1", "abierta"],
  ["abierta-2", "abierta"],
  ["ganada-1", "ganada"],
  ["perdida-1", "perdida"],
]);

function row(partial: Partial<OportunidadRow> = {}): OportunidadRow {
  return {
    monto_estimado: 1000,
    probabilidad: 50,
    fecha_estimada_cierre: "2026-06-15",
    vendedor_email: "ana@x.com",
    etapa_id: "abierta-1",
    ...partial,
  };
}

function totalesDe(r: ReturnType<typeof computeForecast>, moneda = "MXN") {
  return (
    r.totalesPorMoneda.find((t) => t.moneda === moneda) ?? {
      moneda,
      totalPipeline: 0,
      totalPonderado: 0,
      totalGanado: 0,
    }
  );
}

describe("mesKey / mesLabel", () => {
  it("formatea fechas válidas como YYYY-MM", () => {
    expect(mesKey("2026-01-15")).toBe("2026-01");
    expect(mesKey("2026-12-01")).toBe("2026-12");
  });

  it("devuelve 'Sin fecha' para null o inválida", () => {
    expect(mesKey(null)).toBe("Sin fecha");
    expect(mesKey("no-es-fecha")).toBe("Sin fecha");
  });

  it("convierte la clave a etiqueta legible en español", () => {
    expect(mesLabel("2026-01")).toBe("Ene 2026");
    expect(mesLabel("2026-12")).toBe("Dic 2026");
    expect(mesLabel("Sin fecha")).toBe("Sin fecha");
  });
});

describe("computeForecast", () => {
  it("regresa vacío cuando no hay filas", () => {
    const r = computeForecast([], etapaTipos);
    expect(r.totalesPorMoneda).toEqual([]);
    expect(r.porMes).toEqual([]);
    expect(r.porVendedor).toEqual([]);
  });

  it("suma pipeline y ponderado sólo para etapas abiertas", () => {
    const r = computeForecast(
      [
        row({ monto_estimado: 1000, probabilidad: 50, etapa_id: "abierta-1" }),
        row({ monto_estimado: 500, probabilidad: 80, etapa_id: "abierta-2" }),
        row({ monto_estimado: 999, probabilidad: 100, etapa_id: "perdida-1" }),
      ],
      etapaTipos,
    );
    const t = totalesDe(r);
    expect(t.totalPipeline).toBe(1500);
    expect(t.totalPonderado).toBe(1000 * 0.5 + 500 * 0.8);
    expect(t.totalGanado).toBe(0);
  });

  it("suma ganado sólo para etapas ganadas (usa monto_estimado)", () => {
    const r = computeForecast(
      [
        row({ monto_estimado: 2000, etapa_id: "ganada-1" }),
        row({ monto_estimado: 1000, etapa_id: "perdida-1" }),
      ],
      etapaTipos,
    );
    const t = totalesDe(r);
    expect(t.totalGanado).toBe(2000);
    expect(t.totalPipeline).toBe(0);
  });

  it("agrupa por mes y por vendedor, con 'Sin asignar' como fallback", () => {
    const r = computeForecast(
      [
        row({ vendedor_email: null, fecha_estimada_cierre: "2026-06-10" }),
        row({ vendedor_email: "ana@x.com", fecha_estimada_cierre: "2026-06-20" }),
        row({ vendedor_email: "ana@x.com", fecha_estimada_cierre: "2026-07-01" }),
      ],
      etapaTipos,
    );
    expect(r.porMes.map((b) => b.key)).toEqual(["2026-06|MXN", "2026-07|MXN"]);
    const ana = r.porVendedor.find((v) => v.key === "ana@x.com|MXN")!;
    expect(ana.count).toBe(2);
    expect(r.porVendedor.find((v) => v.key === "Sin asignar|MXN")!.count).toBe(1);
  });

  it("ordena vendedores por ponderado descendente", () => {
    const r = computeForecast(
      [
        row({ vendedor_email: "low@x.com", monto_estimado: 100, probabilidad: 10 }),
        row({ vendedor_email: "high@x.com", monto_estimado: 1000, probabilidad: 80 }),
        row({ vendedor_email: "mid@x.com", monto_estimado: 500, probabilidad: 50 }),
      ],
      etapaTipos,
    );
    expect(r.porVendedor.map((v) => v.label)).toEqual([
      "high@x.com", "mid@x.com", "low@x.com",
    ]);
  });

  it("trata strings numéricos y nulls como 0 sin romperse", () => {
    const r = computeForecast(
      [
        row({ monto_estimado: "1500" as unknown as number, probabilidad: "40" as unknown as number }),
        row({ monto_estimado: null, probabilidad: null }),
      ],
      etapaTipos,
    );
    const t = totalesDe(r);
    expect(t.totalPipeline).toBe(1500);
    expect(t.totalPonderado).toBe(1500 * 0.4);
  });

  it("separa totales por moneda: 100k MXN + 10k USD + importe EUR no se mezclan", () => {
    const r = computeForecast(
      [
        row({ monto_estimado: 100000, probabilidad: 100, etapa_id: "abierta-1", moneda: "MXN" }),
        row({ monto_estimado: 10000, probabilidad: 100, etapa_id: "abierta-1", moneda: "USD" }),
        row({ monto_estimado: 5000, probabilidad: 100, etapa_id: "ganada-1", moneda: "EUR" }),
      ],
      etapaTipos,
    );
    expect(r.totalesPorMoneda).toHaveLength(3);
    expect(totalesDe(r, "MXN").totalPipeline).toBe(100000);
    expect(totalesDe(r, "USD").totalPipeline).toBe(10000);
    expect(totalesDe(r, "EUR").totalGanado).toBe(5000);
    expect(totalesDe(r, "USD").totalGanado).toBe(0);
  });

  it("con más de 50 oportunidades calcula totales completos por moneda", () => {
    const filas: OportunidadRow[] = Array.from({ length: 60 }, (_, i) =>
      row({ monto_estimado: 100, probabilidad: 100, etapa_id: "abierta-1", moneda: "MXN", vendedor_email: `v${i}@x.com` }),
    );
    const r = computeForecast(filas, etapaTipos);
    expect(totalesDe(r, "MXN").totalPipeline).toBe(6000);
    expect(r.porVendedor).toHaveLength(60);
  });
});

describe("computeReportesCRM", () => {
  const etapaInfo = new Map<string, { nombre: string; tipo: EtapaTipo }>([
    ["e1", { nombre: "Prospección", tipo: "abierta" }],
    ["e2", { nombre: "Cotizando", tipo: "abierta" }],
    ["e3", { nombre: "Ganada", tipo: "ganada" }],
    ["e4", { nombre: "Perdida", tipo: "perdida" }],
  ]);
  const motivos = new Map([
    ["m1", "Precio"],
    ["m2", "Tiempo"],
  ]);

  it("cuenta embudo por nombre de etapa y agrupa 'Sin etapa' si falta", () => {
    const r = computeReportesCRM(
      [],
      [
        { etapa_id: "e1", motivo_perdida_id: null },
        { etapa_id: "e1", motivo_perdida_id: null },
        { etapa_id: "e2", motivo_perdida_id: null },
        { etapa_id: null, motivo_perdida_id: null },
      ],
      etapaInfo,
      motivos,
    );
    const map = Object.fromEntries(r.embudo.map((e) => [e.etapa, e.cantidad]));
    expect(map).toEqual({ "Prospección": 2, "Cotizando": 1, "Sin etapa": 1 });
  });

  it("computa tasa de conversión por fuente", () => {
    const r = computeReportesCRM(
      [
        { fuente: "Web", estado: "Convertido" },
        { fuente: "Web", estado: "Nuevo" },
        { fuente: "Web", estado: "Nuevo" },
        { fuente: null, estado: "Convertido" },
      ],
      [],
      etapaInfo,
      motivos,
    );
    const web = r.porFuente.find((f) => f.fuente === "Web")!;
    expect(web.total).toBe(3);
    expect(web.convertidos).toBe(1);
    expect(web.tasa).toBeCloseTo((1 / 3) * 100, 4);
    const otro = r.porFuente.find((f) => f.fuente === "Otro")!;
    expect(otro.tasa).toBe(100);
  });

  it("rankea motivos de pérdida y limita a 5", () => {
    const opsConPerdida = [
      ...Array(4).fill({ etapa_id: "e4", motivo_perdida_id: "m1" }),
      ...Array(2).fill({ etapa_id: "e4", motivo_perdida_id: "m2" }),
      // motivo desconocido → "Otro"
      { etapa_id: "e4", motivo_perdida_id: "desconocido" },
      // no-perdida → no cuenta motivos
      { etapa_id: "e1", motivo_perdida_id: "m1" },
    ];
    const r = computeReportesCRM([], opsConPerdida, etapaInfo, motivos);
    expect(r.motivosPerdida[0]).toEqual({ motivo: "Precio", cantidad: 4 });
    expect(r.motivosPerdida[1]).toEqual({ motivo: "Tiempo", cantidad: 2 });
    expect(r.motivosPerdida[2]).toEqual({ motivo: "Otro", cantidad: 1 });
    expect(r.motivosPerdida.length).toBeLessThanOrEqual(5);
  });
});
