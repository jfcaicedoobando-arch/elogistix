import { describe, it, expect } from "vitest";
import { computeNextBestActions } from "@/features/crm/domain/nextBestActions";

const NOW = new Date("2026-06-15T12:00:00Z");

function isoHoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
}
function isoDaysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString();
}

describe("computeNextBestActions", () => {
  it("incluye lead sin contactar > 24h y excluye los recientes", () => {
    const items = computeNextBestActions({
      leadsSinContactar: [
        { id: "l1", empresa: "Acme", created_at: isoHoursAgo(48) },
        { id: "l2", empresa: "Nuevo", created_at: isoHoursAgo(2) },
      ],
      oportunidadesAbiertas: [],
      cotizacionesSinRespuesta: [],
      actividadesVencidas: [],
      now: NOW,
    });
    expect(items.map((i) => i.id)).toEqual(["lead:l1"]);
    expect(items[0].regla).toBe("lead_sin_contactar");
  });

  it("incluye cotización sin respuesta y la enlaza a la oportunidad si existe", () => {
    const items = computeNextBestActions({
      leadsSinContactar: [],
      oportunidadesAbiertas: [],
      cotizacionesSinRespuesta: [
        { id: "c1", folio: "Q-100", cliente_nombre: "Acme", dias: 7, oportunidad_id: "op-9" },
      ],
      actividadesVencidas: [],
      now: NOW,
    });
    expect(items[0].href).toBe("/crm/oportunidades/op-9");
    expect(items[0].regla).toBe("cot_sin_respuesta");
  });

  it("detecta cierre próximo ≤3 días y oportunidad estancada >7 días", () => {
    const cerca = new Date(NOW.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
    const items = computeNextBestActions({
      leadsSinContactar: [],
      oportunidadesAbiertas: [
        { id: "op1", nombre: "Cerrar pronto", fecha_estimada_cierre: cerca, updated_at: isoDaysAgo(1) },
        { id: "op2", nombre: "Olvidada", fecha_estimada_cierre: null, updated_at: isoDaysAgo(15) },
      ],
      cotizacionesSinRespuesta: [],
      actividadesVencidas: [],
      now: NOW,
    });
    const reglas = items.map((i) => i.regla);
    expect(reglas).toContain("op_cierre_proximo");
    expect(reglas).toContain("op_sin_actividad");
  });

  it("ordena por score descendente y respeta el límite", () => {
    const items = computeNextBestActions(
      {
        leadsSinContactar: [{ id: "l1", empresa: "A", created_at: isoHoursAgo(48) }],
        oportunidadesAbiertas: [],
        cotizacionesSinRespuesta: [
          { id: "c1", folio: "Q1", cliente_nombre: "B", dias: 6, oportunidad_id: null },
        ],
        actividadesVencidas: [
          { id: "a1", asunto: "Llamar", fecha_programada: isoDaysAgo(1), entidad_tipo: "lead", entidad_id: "l1" },
          { id: "a2", asunto: "Mail", fecha_programada: isoDaysAgo(2), entidad_tipo: "oportunidad", entidad_id: "op9" },
        ],
        now: NOW,
      },
      2,
    );
    expect(items).toHaveLength(2);
    expect(items[0].score).toBeGreaterThanOrEqual(items[1].score);
    // Vencidas ahora son prioridad máxima (score ≥ 110)
    expect(items[0].regla).toBe("actividad_vencida");
  });
});

describe("FIX-9: cierre próximo compara como día calendario LOCAL (MX)", () => {
  it("incluye una oportunidad que cierra HOY aunque 'now' ya sea tarde en UTC", () => {
    // 2026-06-16T04:00:00Z == 2026-06-15 22:00 CDMX: calendario MX aún 15-jun.
    const ahoraTardeUtc = new Date("2026-06-16T04:00:00Z");
    const items = computeNextBestActions({
      leadsSinContactar: [],
      oportunidadesAbiertas: [
        { id: "op1", nombre: "Cierra hoy", fecha_estimada_cierre: "2026-06-15", updated_at: ahoraTardeUtc.toISOString() },
      ],
      cotizacionesSinRespuesta: [],
      actividadesVencidas: [],
      now: ahoraTardeUtc,
    });
    const cierre = items.find((i) => i.id === "cierre:op1");
    expect(cierre).toBeDefined();
    expect(cierre?.subtitulo).toContain("0 día");
  });
});
