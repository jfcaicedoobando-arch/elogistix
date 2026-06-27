import { describe, it, expect } from "vitest";
import {
  agregarPendientes,
  calcularScore,
  calcularRegresion,
  agruparPorEtapaYCliente,
  calcularVencimientos,
  calcularRanking,
  RIESGO_UMBRAL_MXN,
} from "../ejecutivoAgregados";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";


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
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const en2 = new Date(); en2.setDate(en2.getDate() + 2);
    const ayerIso = ayer.toISOString().slice(0, 10);
    const en2Iso = en2.toISOString().slice(0, 10);
    const r = calcularVencimientos([
      h({ eta: ayerIso }),
      h({ eta: en2Iso }),
      h({ eta: null }),
    ]);
    expect(r.pendientesVencidos).toBe(1);
    expect(r.pendientesUrgentesPorEta).toBe(1);
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
});
