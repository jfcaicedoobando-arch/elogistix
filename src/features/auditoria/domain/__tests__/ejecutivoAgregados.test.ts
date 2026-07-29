import { describe, it, expect } from "vitest";
import {
  agregarPendientes,
  calcularScore,
  calcularRegresion,
  agruparPorEtapaYCliente,
  calcularVencimientos,
  calcularRanking,
  RIESGO_UMBRAL_MXN,
  esHallazgoEtaVencida,
  hoyAuditoriaIso,
} from "../ejecutivoAgregados";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";



/** Offset en días sobre "hoy" en zona CDMX (misma base que calcularVencimientos). */
const isoMxOffset = (d: number) => hoyAuditoriaIso(new Date(Date.now() + d * 86_400_000));

const h = (over: Partial<HallazgoAuditoria>): HallazgoAuditoria =>
  ({
    embarque_id: "e1", expediente: "EXP-1", cliente_nombre: "ACME",
    regla: "fechas", severidad: "alto", detalle: "x", estado: "Aduana", eta: null,
    ...over,
  } as HallazgoAuditoria);

describe("ejecutivoAgregados", () => {
  it("agregarPendientes pondera severidad y filtra riesgo financiero", () => {
    const out = agregarPendientes([
      h({ severidad: "critico", regla: "margen_negativo", monto_mxn: 1000 }),
      h({ severidad: "alto", regla: "margen_bajo", monto_mxn: 500 }),
      h({ severidad: "medio", regla: "fechas", monto_mxn: 9999 }), // no es regla financiera
      h({ severidad: "critico", regla: "proforma_vencida", monto_mxn: -300 }), // negativo -> 0
    ]);
    expect(out.suma).toBe(5 + 2 + 1 + 5);
    expect(out.porSeveridad).toEqual({ critico: 2, alto: 1, medio: 1 });
    expect(out.riesgoFinancieroMxn).toBe(1500);
    expect(out.riesgoPorRegla.margen_negativo).toBe(1000);
    expect(out.riesgoPorRegla.proforma_vencida).toBe(0);
  });

  it("calcularScore traduce a estados cualitativos", () => {
    expect(calcularScore(0, 0).score).toBe(100);
    expect(calcularScore(0, 0).scoreEstado).toBe("excelente");
    expect(calcularScore(10, 5).scoreEstado).toBe("bueno"); // 100-20=80 → bueno
    expect(calcularScore(20, 5).scoreEstado).toBe("regular"); // 100-40=60 → regular
  });

  it("calcularScore: penalización 0 con pendientes = 100", () => {
    expect(calcularScore(0, 3).score).toBe(100);
  });

  it("calcularScore: pendientes saturan a 'malo' con suma alta", () => {
    const r = calcularScore(50, 10); // penalización 100 → score 0
    expect(r.score).toBe(0);
    expect(r.scoreEstado).toBe("malo");
  });

  it("agruparPorEtapaYCliente ordena por críticos descendente", () => {
    const { topClientes, porEtapa } = agruparPorEtapaYCliente([
      h({ cliente_nombre: "A", severidad: "critico", estado: "Aduana" }),
      h({ cliente_nombre: "A", severidad: "alto", estado: "Aduana" }),
      h({ cliente_nombre: "B", severidad: "critico", estado: "Tránsito" }),
      h({ cliente_nombre: "B", severidad: "critico", estado: "Tránsito" }),
    ]);
    expect(topClientes[0].cliente).toBe("B");
    expect(topClientes[0].criticos).toBe(2);
    expect(porEtapa[0].etapa).toBe("Aduana");
  });

  it("calcularVencimientos distingue vencidos vs urgentes", () => {
    const ayerIso = isoMxOffset(-1);
    const en2Iso = isoMxOffset(2);
    const r = calcularVencimientos([
      h({ eta: ayerIso }),
      h({ eta: en2Iso }),
      h({ eta: null }),
    ]);
    expect(r.pendientesVencidos).toBe(1);
    expect(r.pendientesUrgentesPorEta).toBe(1);
  });

  it("calcularVencimientos excluye reglas con vencimiento propio (CXP/CXC/proformas)", () => {
    const ayerIso = isoMxOffset(-5);
    const en2Iso = isoMxOffset(2);
    const r = calcularVencimientos([
      h({ eta: ayerIso, regla: "cxp_vencida" }),
      h({ eta: ayerIso, regla: "cxp_por_capturar_estancada" }),
      h({ eta: ayerIso, regla: "cxc_vencida" }),
      h({ eta: ayerIso, regla: "proforma_vencida" }),
      h({ eta: en2Iso, regla: "cxp_vencida" }),
      h({ eta: ayerIso, regla: "docs_faltantes" }), // sí cuenta
    ]);
    expect(r.pendientesVencidos).toBe(1);
    expect(r.pendientesUrgentesPorEta).toBe(0);
    expect(r.edadPromediaPendientesDias).toBe(5);
  });


  it("calcularRanking separa responsables y revisores, usa revisado_at para MTTR", () => {
    const rev = (over: Partial<AuditoriaRevision>) =>
      ({ estado_revision: "pendiente", responsable_email: "op@x.com", revisado_por_email: "", asignado_at: null, updated_at: "", revisado_at: null, fecha_limite: null, ...over } as AuditoriaRevision);
    const map = new Map<string, AuditoriaRevision>([
      // resuelto: asignado a A, marcado revisado por B. MTTR = 10h (asignado→revisado_at).
      // updated_at se mueve a +5d por un comentario posterior; NO debe contar.
      ["k1", rev({
        estado_revision: "revisado",
        responsable_email: "alice@x.com",
        revisado_por_email: "bob@x.com",
        asignado_at: "2026-05-01T00:00:00Z",
        revisado_at: "2026-05-01T10:00:00Z",
        updated_at: "2026-05-06T15:00:00Z",
      })],
      ["k2", rev({ responsable_email: "alice@x.com" })],
    ]);
    const out = calcularRanking(map, "2026-05-25");
    expect(out.mttrHoras).toBe(10); // usa revisado_at, no updated_at (que daría 5d)
    expect(out.rankingResponsables[0].email).toBe("alice@x.com");
    expect(out.rankingResponsables[0].resueltos).toBe(1);
    expect(out.rankingResponsables[0].pendientes).toBe(1);
    expect(out.rankingRevisores[0].email).toBe("bob@x.com");
    expect(out.rankingRevisores[0].resueltos).toBe(1);
    // Alias retrocompatible
    expect(out.rankingOperadores).toBe(out.rankingResponsables);
  });

  it("calcularScore 60/40: riesgoMxn arrastra el score hacia abajo", () => {
    // Sin riesgo: comportamiento legado (sólo higiene) → score 80
    expect(calcularScore(10, 5, 0).score).toBe(80);
    // Con riesgo = umbral → economico=0 → score = 0.4*80 + 0.6*0 = 32
    const r = calcularScore(10, 5, RIESGO_UMBRAL_MXN);
    expect(r.score).toBe(32);
    expect(r.scoreEstado).toBe("malo");
    // Saturación: riesgo > umbral no baja del piso
    expect(calcularScore(0, 1, RIESGO_UMBRAL_MXN * 10).score).toBe(40);
  });

  it("calcularRegresion empata snapshot más cercano a 7 días", () => {
    const hoy = new Date();
    const hace7 = new Date(hoy.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const hace14 = new Date(hoy.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
    const reg = calcularRegresion(70, [
      { fecha: hace14, score: 90 },
      { fecha: hace7, score: 85 },
    ], 7);
    expect(reg).not.toBeNull();
    expect(reg!.scoreAnterior).toBe(85);
    expect(reg!.diferencia).toBe(-15);
  });

  it("calcularRegresion retorna null si no hay snapshot dentro de ±3 días", () => {
    const hace20 = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    expect(calcularRegresion(70, [{ fecha: hace20, score: 90 }], 7)).toBeNull();
    expect(calcularRegresion(70, [], 7)).toBeNull();
  });
});


describe("esHallazgoEtaVencida — paridad tarjeta/tabla", () => {
  const base = {
    embarque_id: "e1",
    expediente: "EXP-001",
    cliente_nombre: "ACME",
    severidad: "critico",
    detalle: "x",
  } as unknown as HallazgoAuditoria;

  it("sólo cuenta ETA estrictamente anterior a hoy", () => {
    expect(esHallazgoEtaVencida({ ...base, regla: "docs_faltantes", eta: "2026-07-09" }, "2026-07-10")).toBe(true);
    expect(esHallazgoEtaVencida({ ...base, regla: "docs_faltantes", eta: "2026-07-10" }, "2026-07-10")).toBe(false);
  });

  it("excluye reglas con calendario propio y hallazgos sin ETA", () => {
    expect(esHallazgoEtaVencida({ ...base, regla: "cxp_vencida", eta: "2026-07-01" }, "2026-07-10")).toBe(false);
    expect(esHallazgoEtaVencida({ ...base, regla: "docs_faltantes", eta: null }, "2026-07-10")).toBe(false);
  });

  it("el conteo de la tarjeta coincide con el predicado del filtro", () => {
    const hoy = hoyAuditoriaIso();
    const ayer = isoMxOffset(-1);
    const hallazgos = [
      { ...base, regla: "docs_faltantes", eta: ayer },
      { ...base, regla: "cxp_vencida", eta: ayer },
      { ...base, regla: "docs_faltantes", eta: hoy },
    ] as HallazgoAuditoria[];
    const { pendientesVencidos } = calcularVencimientos(hallazgos);
    const porFiltro = hallazgos.filter((h) => esHallazgoEtaVencida(h, hoy)).length;
    expect(porFiltro).toBe(pendientesVencidos);
  });
});
