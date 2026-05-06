/**
 * Tests del hook `useAuditoriaEjecutivo` — cubre derivación de KPIs ejecutivos
 * (score, distribuciones, riesgo financiero, MTTR, ranking) sin tocar Supabase.
 *
 * Mockeamos `useAuditoria` y `useAuditoriaRevisiones` para inyectar fixtures
 * deterministas y verificar la lógica pura de `useMemo`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type {
  AuditoriaRevision,
  HallazgoAuditoria,
  ReporteAuditoria,
} from "@/types/auditoria";

vi.mock("@/hooks/auditoria/useAuditoria", () => ({
  useAuditoria: vi.fn(),
}));
vi.mock("@/hooks/auditoria/useAuditoriaRevisiones", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/auditoria/useAuditoriaRevisiones")>(
    "@/hooks/auditoria/useAuditoriaRevisiones",
  );
  return {
    ...actual,
    useAuditoriaRevisiones: vi.fn(),
  };
});

import { useAuditoria } from "@/hooks/auditoria/useAuditoria";
import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import { useAuditoriaEjecutivo } from "@/hooks/auditoria/useAuditoriaEjecutivo";

const mockUseAuditoria = vi.mocked(useAuditoria);
const mockUseRevisiones = vi.mocked(useAuditoriaRevisiones);

function h(partial: Partial<HallazgoAuditoria>): HallazgoAuditoria {
  return {
    embarque_id: "emb-1",
    expediente: "EXP-001",
    cliente_nombre: "ACME",
    modo: "Marítimo",
    estado: "En tránsito",
    eta: null,
    regla: "docs_faltantes",
    severidad: "medio",
    detalle: "detalle",
    documentos_faltantes: [],
    ...partial,
  };
}

function reporte(hallazgos: HallazgoAuditoria[]): ReporteAuditoria {
  return {
    generated_at: "2026-05-06T12:00:00Z",
    total_hallazgos: hallazgos.length,
    por_severidad: { critico: 0, alto: 0, medio: 0 },
    por_regla: {
      docs_faltantes: 0, docs_pendientes_avanzado: 0, fechas: 0,
      ventas_sin_facturar: 0, margen_negativo: 0, margen_bajo: 0,
      venta_sin_costo: 0, costo_sin_venta: 0, proforma_vencida: 0,
      embarque_huerfano: 0,
    },
    hallazgos,
  };
}

function setMocks(
  hallazgos: HallazgoAuditoria[],
  revisiones?: Map<string, AuditoriaRevision>,
) {
  mockUseAuditoria.mockReturnValue({
    data: reporte(hallazgos),
    isLoading: false,
  } as unknown as ReturnType<typeof useAuditoria>);
  mockUseRevisiones.mockReturnValue({
    data: revisiones,
  } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuditoriaEjecutivo", () => {
  it("score = 100 y estado 'excelente' cuando no hay hallazgos pendientes", () => {
    setMocks([]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.score).toBe(100);
    expect(result.current.scoreEstado).toBe("excelente");
    expect(result.current.totalPendientes).toBe(0);
    expect(result.current.porcentajeAtendidos).toBe(100);
  });

  it("penaliza score con peso por severidad (critico=5, alto=2, medio=1)", () => {
    // 1 crítico (5) + 2 altos (4) + 1 medio (1) = 10 → penalización 20 → score 80 ('bueno')
    setMocks([
      h({ embarque_id: "a", severidad: "critico" }),
      h({ embarque_id: "b", severidad: "alto" }),
      h({ embarque_id: "c", severidad: "alto" }),
      h({ embarque_id: "d", severidad: "medio" }),
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.score).toBe(80);
    expect(result.current.scoreEstado).toBe("bueno");
    expect(result.current.porSeveridad).toEqual({ critico: 1, alto: 2, medio: 1 });
  });

  it("excluye hallazgos ya revisados de los pendientes y recalcula porcentajeAtendidos", () => {
    const revisado = h({ embarque_id: "x", regla: "docs_faltantes", detalle: "d" });
    const pendiente = h({ embarque_id: "y", regla: "fechas", detalle: "d2" });
    const map = new Map<string, AuditoriaRevision>();
    map.set(revisionKey(revisado), {
      id: "r1",
      embarque_id: revisado.embarque_id,
      regla: revisado.regla,
      detalle_hash: "h",
      detalle: revisado.detalle,
      accion_tomada: null,
      revisado_por: null,
      revisado_por_email: "op@x.mx",
      estado_revision: "revisado",
      responsable_id: null,
      responsable_email: "op@x.mx",
      asignado_por: null,
      asignado_por_email: "",
      asignado_at: null,
      fecha_limite: null,
      snoozed_until: null,
      snooze_motivo: null,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-02T00:00:00Z",
    });
    setMocks([revisado, pendiente], map);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.totalPendientes).toBe(1);
    expect(result.current.totalRevisados).toBe(1);
    expect(result.current.porcentajeAtendidos).toBe(50);
  });

  it("acumula riesgo financiero MXN sólo de reglas financieras", () => {
    setMocks([
      h({ embarque_id: "1", regla: "margen_negativo", monto_mxn: 10000 }),
      h({ embarque_id: "2", regla: "margen_bajo", monto_mxn: 5000 }),
      h({ embarque_id: "3", regla: "proforma_vencida", monto_mxn: 2500 }),
      h({ embarque_id: "4", regla: "docs_faltantes", monto_mxn: 99999 }), // ignorada
      h({ embarque_id: "5", regla: "margen_negativo", monto_mxn: -300 }), // clampeado a 0
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.riesgoFinancieroMxn).toBe(17500);
    expect(result.current.riesgoPorRegla.margen_negativo).toBe(10000);
    expect(result.current.riesgoPorRegla.margen_bajo).toBe(5000);
    expect(result.current.riesgoPorRegla.proforma_vencida).toBe(2500);
    expect(result.current.riesgoPorRegla.docs_faltantes).toBeUndefined();
  });

  it("clasifica ETAs en vencidos, urgentes (≤3 días) y calcula edad promedio", () => {
    const today = new Date();
    const offset = (d: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() + d);
      return x.toISOString().slice(0, 10);
    };
    setMocks([
      h({ embarque_id: "v1", eta: offset(-10) }),
      h({ embarque_id: "v2", eta: offset(-4) }),
      h({ embarque_id: "u1", eta: offset(2) }),
      h({ embarque_id: "u2", eta: offset(3) }),
      h({ embarque_id: "f", eta: offset(15) }),
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.pendientesVencidos).toBe(2);
    expect(result.current.pendientesUrgentesPorEta).toBe(2);
    expect(result.current.edadPromediaPendientesDias).toBe(7); // (10+4)/2
  });

  it("agrupa por etapa y top clientes ordenando por críticos primero", () => {
    setMocks([
      h({ embarque_id: "1", estado: "En tránsito", cliente_nombre: "ACME", severidad: "critico" }),
      h({ embarque_id: "2", estado: "En tránsito", cliente_nombre: "ACME", severidad: "medio" }),
      h({ embarque_id: "3", estado: "Liberado", cliente_nombre: "Globex", severidad: "alto" }),
      h({ embarque_id: "4", estado: "Liberado", cliente_nombre: "Globex", severidad: "critico" }),
      h({ embarque_id: "5", estado: "Liberado", cliente_nombre: "Globex", severidad: "critico" }),
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.porEtapa[0]).toEqual({ etapa: "Liberado", total: 3, criticos: 2 });
    expect(result.current.topClientes[0]).toEqual({ cliente: "Globex", total: 3, criticos: 2 });
  });

  it("calcula MTTR en horas y arma ranking de operadores", () => {
    const map = new Map<string, AuditoriaRevision>();
    const baseRev: Omit<AuditoriaRevision, "id" | "estado_revision" | "responsable_email" | "asignado_at" | "updated_at"> = {
      embarque_id: "e",
      regla: "docs_faltantes",
      detalle_hash: "h",
      detalle: "d",
      accion_tomada: null,
      revisado_por: null,
      revisado_por_email: null,
      responsable_id: null,
      asignado_por: null,
      asignado_por_email: "",
      fecha_limite: null,
      snoozed_until: null,
      snooze_motivo: null,
      created_at: "2026-05-01T00:00:00Z",
    };
    map.set("k1", {
      ...baseRev, id: "1", estado_revision: "revisado", responsable_email: "op1@x.mx",
      asignado_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T10:00:00Z", // 10h
    });
    map.set("k2", {
      ...baseRev, id: "2", estado_revision: "revisado", responsable_email: "op1@x.mx",
      asignado_at: "2026-05-02T00:00:00Z", updated_at: "2026-05-02T20:00:00Z", // 20h
    });
    map.set("k3", {
      ...baseRev, id: "3", estado_revision: "pendiente", responsable_email: "op2@x.mx",
      asignado_at: null, updated_at: "2026-05-01T00:00:00Z",
    });
    setMocks([], map);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.mttrHoras).toBe(15); // (10+20)/2
    const op1 = result.current.rankingOperadores.find((o) => o.email === "op1@x.mx");
    const op2 = result.current.rankingOperadores.find((o) => o.email === "op2@x.mx");
    expect(op1).toMatchObject({ resueltos: 2, pendientes: 0 });
    expect(op2).toMatchObject({ resueltos: 0, pendientes: 1 });
  });

  it("formatea generadoEn en es-MX cuando hay reporte", () => {
    setMocks([]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.generadoEn).toBeTruthy();
  });
});
