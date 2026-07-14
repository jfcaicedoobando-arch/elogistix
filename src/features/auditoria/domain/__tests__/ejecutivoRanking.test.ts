import { describe, it, expect } from "vitest";
import { calcularRanking } from "../ejecutivoRanking";
import type { AuditoriaRevision } from "@/features/auditoria/types";

const hoyIso = "2026-07-06";

function mkRev(overrides: Partial<AuditoriaRevision>): AuditoriaRevision {
  return {
    id: "r1",
    organization_id: "org1",
    embarque_id: "e1",
    regla: "docs_faltantes",
    detalle_hash: "h",
    detalle: "d",
    estado_revision: "pendiente",
    responsable_email: null,
    responsable_id: null,
    revisado_por: null,
    revisado_por_email: null,
    revisado_at: null,
    asignado_at: null,
    asignado_por: null,
    asignado_por_email: null,
    fecha_limite: null,
    accion_tomada: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  } as AuditoriaRevision;
}

describe("calcularRanking", () => {
  it("retorna arrays vacíos y mttr null cuando no hay revisiones", () => {
    const r = calcularRanking(undefined, hoyIso);
    expect(r.mttrHoras).toBeNull();
    expect(r.rankingResponsables).toEqual([]);
    expect(r.rankingRevisores).toEqual([]);
  });

  it("cuenta resueltos y calcula MTTR promedio", () => {
    const map = new Map<string, AuditoriaRevision>();
    map.set("a", mkRev({
      estado_revision: "revisado",
      responsable_email: "op@x.com",
      asignado_at: "2026-07-04T00:00:00Z",
      revisado_at: "2026-07-05T00:00:00Z", // 24h
    }));
    map.set("b", mkRev({
      estado_revision: "revisado",
      responsable_email: "op@x.com",
      asignado_at: "2026-07-01T00:00:00Z",
      revisado_at: "2026-07-03T00:00:00Z", // 48h
      revisado_por_email: "rev@x.com",
    }));
    const r = calcularRanking(map, hoyIso);
    expect(r.mttrHoras).toBe(36);
    expect(r.rankingResponsables[0]).toMatchObject({ email: "op@x.com", resueltos: 2 });
    expect(r.rankingRevisores[0]).toMatchObject({ email: "rev@x.com", resueltos: 1 });
  });

  it("cuenta pendientes y vencidos", () => {
    const map = new Map<string, AuditoriaRevision>();
    map.set("a", mkRev({
      estado_revision: "pendiente",
      responsable_email: "op@x.com",
      fecha_limite: "2026-07-01", // < hoy
    }));
    map.set("b", mkRev({
      estado_revision: "pendiente",
      responsable_email: "op@x.com",
      fecha_limite: "2026-07-30",
    }));
    const r = calcularRanking(map, hoyIso);
    expect(r.rankingResponsables[0]).toMatchObject({ pendientes: 2, vencidos: 1 });
    expect(r.mttrHoras).toBeNull();
  });

  it('agrupa como "Sin asignar" cuando no hay responsable_email', () => {
    const map = new Map<string, AuditoriaRevision>();
    map.set("a", mkRev({ estado_revision: "pendiente" }));
    const r = calcularRanking(map, hoyIso);
    expect(r.rankingResponsables[0].email).toBe("Sin asignar");
  });

  it("usa created_at como fallback cuando asignado_at es null (flujo real)", () => {
    const map = new Map<string, AuditoriaRevision>();
    map.set("a", mkRev({
      estado_revision: "revisado",
      responsable_email: "op@x.com",
      asignado_at: null,
      created_at: "2026-07-04T00:00:00Z",
      revisado_at: "2026-07-05T00:00:00Z", // 24h desde created_at
    }));
    const r = calcularRanking(map, hoyIso);
    expect(r.mttrHoras).toBe(24);
  });

  it("rankingOperadores es alias de rankingResponsables", () => {
    const r = calcularRanking(new Map(), hoyIso);
    expect(r.rankingOperadores).toBe(r.rankingResponsables);
  });
});

