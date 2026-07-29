import { describe, it, expect } from "vitest";
import { matchHallazgo, type MatchCtx } from "../hallazgosTablaFilters";
import { revisionKey } from "../../hooks/revisiones/hash";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

function mkHallazgo(overrides: Partial<HallazgoAuditoria> = {}): HallazgoAuditoria {
  return {
    embarque_id: "e1",
    expediente: "EXP-001",
    cliente_nombre: "ACME",
    regla: "docs_faltantes",
    severidad: "critico",
    detalle: "faltan documentos",
    eta: "2026-07-10",
    ...overrides,
  } as HallazgoAuditoria;
}

const baseCtx: MatchCtx = {
  q: "",
  desde: null,
  hasta: null,
  today: "2026-07-06",
  filtroRegla: "todas",
  filtroSev: "todas",
  filtroCliente: "todos",
  filtroRevision: "todos",
  filtroResponsable: "todos",
  soloEtaVencida: false,
  userId: "u1",
  revisiones: undefined,
};

describe("matchHallazgo", () => {
  it("acepta cuando todos los filtros están en 'todas/todos'", () => {
    expect(matchHallazgo(mkHallazgo(), baseCtx)).toBe(true);
  });

  it("filtra por texto en expediente/cliente/detalle", () => {
    const h = mkHallazgo();
    expect(matchHallazgo(h, { ...baseCtx, q: "acme" })).toBe(true);
    expect(matchHallazgo(h, { ...baseCtx, q: "zzz" })).toBe(false);
  });

  it("filtra por regla y severidad", () => {
    const h = mkHallazgo();
    expect(matchHallazgo(h, { ...baseCtx, filtroRegla: "fechas" })).toBe(false);
    expect(matchHallazgo(h, { ...baseCtx, filtroSev: "alto" })).toBe(false);
  });

  it("filtra por cliente exacto", () => {
    expect(matchHallazgo(mkHallazgo(), { ...baseCtx, filtroCliente: "ACME" })).toBe(true);
    expect(matchHallazgo(mkHallazgo(), { ...baseCtx, filtroCliente: "OTRA" })).toBe(false);
  });

  it("filtra por rango de fechas ETA", () => {
    const h = mkHallazgo({ eta: "2026-07-10" });
    expect(matchHallazgo(h, { ...baseCtx, desde: "2026-07-01", hasta: "2026-07-31" })).toBe(true);
    expect(matchHallazgo(h, { ...baseCtx, desde: "2026-08-01" })).toBe(false);
  });

  it("filtroRevision 'revisados' requiere estado_revision=revisado", () => {
    const h = mkHallazgo();
    const revisiones = new Map([[revisionKey(h), { estado_revision: "revisado" }]]);
    expect(matchHallazgo(h, { ...baseCtx, filtroRevision: "revisados", revisiones })).toBe(true);
    expect(matchHallazgo(h, { ...baseCtx, filtroRevision: "revisados" })).toBe(false);
  });

  it("filtroRevision 'pendientes' excluye revisados", () => {
    const h = mkHallazgo();
    const revisiones = new Map([[revisionKey(h), { estado_revision: "revisado" }]]);
    expect(matchHallazgo(h, { ...baseCtx, filtroRevision: "pendientes", revisiones })).toBe(false);
    expect(matchHallazgo(h, { ...baseCtx, filtroRevision: "pendientes" })).toBe(true);
  });

  it("filtroResponsable 'mios' filtra por userId", () => {
    const h = mkHallazgo();
    const revisiones = new Map([[revisionKey(h), { estado_revision: "pendiente", responsable_id: "u1" }]]);
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "mios", revisiones })).toBe(true);
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "mios", userId: "u2", revisiones })).toBe(false);
  });

  it("filtroResponsable 'sin_asignar'", () => {
    const h = mkHallazgo();
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "sin_asignar" })).toBe(true);
    const revisiones = new Map([[revisionKey(h), { estado_revision: "pendiente", responsable_id: "u1" }]]);
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "sin_asignar", revisiones })).toBe(false);
  });

  it("filtroResponsable 'vencidos' considera fecha_limite y estado", () => {
    const h = mkHallazgo();
    const revVencido = new Map([[revisionKey(h), { estado_revision: "pendiente", fecha_limite: "2026-07-01" }]]);
    const revRevisado = new Map([[revisionKey(h), { estado_revision: "revisado", fecha_limite: "2026-07-01" }]]);
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "vencidos", revisiones: revVencido })).toBe(true);
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "vencidos", revisiones: revRevisado })).toBe(false);
    expect(matchHallazgo(h, { ...baseCtx, filtroResponsable: "vencidos" })).toBe(false);
  });
});

describe("matchHallazgo — drill-down 'ETA vencida' (paridad con el dashboard)", () => {
  const ctx: MatchCtx = { ...baseCtx, soloEtaVencida: true, today: "2026-07-10" };

  it("acepta ETA estrictamente anterior a hoy", () => {
    expect(matchHallazgo(mkHallazgo({ eta: "2026-07-09" }), ctx)).toBe(true);
  });

  it("rechaza ETA de hoy (no está vencida)", () => {
    expect(matchHallazgo(mkHallazgo({ eta: "2026-07-10" }), ctx)).toBe(false);
  });

  it("rechaza hallazgos sin ETA", () => {
    expect(matchHallazgo(mkHallazgo({ eta: null }), ctx)).toBe(false);
  });

  it("rechaza reglas con calendario propio", () => {
    expect(matchHallazgo(mkHallazgo({ eta: "2026-07-01", regla: "cxp_vencida" }), ctx)).toBe(false);
    expect(matchHallazgo(mkHallazgo({ eta: "2026-07-01", regla: "proforma_vencida" }), ctx)).toBe(false);
  });

  it("rechaza hallazgos con revisión abierta (en progreso o revisada)", () => {
    const h = mkHallazgo({ eta: "2026-07-01" });
    const revisiones = new Map([[revisionKey(h), { estado_revision: "en_progreso" }]]);
    expect(matchHallazgo(h, { ...ctx, revisiones })).toBe(false);
    const revisadas = new Map([[revisionKey(h), { estado_revision: "revisado" }]]);
    expect(matchHallazgo(h, { ...ctx, revisiones: revisadas })).toBe(false);
  });
});
