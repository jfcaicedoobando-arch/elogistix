/**
 * Tests de bordes para la lógica de Auditoría: datos ausentes, ETAs nulas,
 * sin revisiones, montos inválidos, clientes vacíos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { HallazgoAuditoria, ReporteAuditoria } from "@/types/auditoria";

vi.mock("@/hooks/auditoria/useAuditoria", () => ({
  useAuditoria: vi.fn(),
}));
vi.mock("@/hooks/auditoria/useAuditoriaRevisiones", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/auditoria/useAuditoriaRevisiones")>(
    "@/hooks/auditoria/useAuditoriaRevisiones",
  );
  return { ...actual, useAuditoriaRevisiones: vi.fn() };
});

import { useAuditoria } from "@/hooks/auditoria/useAuditoria";
import { useAuditoriaRevisiones } from "@/hooks/auditoria/useAuditoriaRevisiones";
import { useAuditoriaEjecutivo } from "@/hooks/auditoria/useAuditoriaEjecutivo";

const mockUseAud = vi.mocked(useAuditoria);
const mockUseRev = vi.mocked(useAuditoriaRevisiones);

function h(p: Partial<HallazgoAuditoria>): HallazgoAuditoria {
  return {
    embarque_id: "e",
    expediente: "EXP",
    cliente_nombre: "ACME",
    modo: "Marítimo",
    estado: "En tránsito",
    eta: null,
    regla: "docs_faltantes",
    severidad: "medio",
    detalle: "d",
    documentos_faltantes: [],
    ...p,
  };
}

function setData(hallazgos: HallazgoAuditoria[] | undefined, isLoading = false) {
  const data: ReporteAuditoria | undefined = hallazgos
    ? {
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
      }
    : undefined;
  mockUseAud.mockReturnValue({ data, isLoading } as unknown as ReturnType<typeof useAuditoria>);
  mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
}

beforeEach(() => vi.clearAllMocks());

describe("useAuditoriaEjecutivo — bordes", () => {
  it("estado vacío total: data undefined y loading", () => {
    setData(undefined, true);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.totalHallazgos).toBe(0);
    expect(result.current.score).toBe(100);
    expect(result.current.generadoEn).toBeNull();
  });

  it("ETAs nulas no cuentan como vencidas ni urgentes y edad promedio queda en null", () => {
    setData([
      h({ embarque_id: "1", eta: null, severidad: "critico" }),
      h({ embarque_id: "2", eta: null, severidad: "alto" }),
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.pendientesVencidos).toBe(0);
    expect(result.current.pendientesUrgentesPorEta).toBe(0);
    expect(result.current.edadPromediaPendientesDias).toBeNull();
  });

  it("monto_mxn ausente o no numérico no contamina riesgo financiero", () => {
    setData([
      h({ embarque_id: "1", regla: "margen_negativo" }), // sin monto
      h({ embarque_id: "2", regla: "margen_bajo", monto_mxn: undefined }),
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.riesgoFinancieroMxn).toBe(0);
    expect(result.current.riesgoPorRegla).toEqual({});
  });

  it("cliente_nombre vacío se agrupa como 'Sin cliente'", () => {
    setData([
      h({ embarque_id: "1", cliente_nombre: "" }),
      h({ embarque_id: "2", cliente_nombre: "" }),
    ]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.topClientes[0]).toMatchObject({ cliente: "Sin cliente", total: 2 });
  });

  it("estado vacío se agrupa como '—'", () => {
    setData([h({ embarque_id: "1", estado: "" })]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.porEtapa[0]).toMatchObject({ etapa: "—", total: 1 });
  });

  it("sin revisiones tratamos todos los hallazgos como pendientes y MTTR = null", () => {
    setData([h({ embarque_id: "1" }), h({ embarque_id: "2" })]);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.totalPendientes).toBe(2);
    expect(result.current.totalRevisados).toBe(0);
    expect(result.current.mttrHoras).toBeNull();
    expect(result.current.rankingOperadores).toEqual([]);
  });

  it("score se satura en 0 con muchísimos críticos (penalización > 100)", () => {
    // 30 críticos × 5 = 150 → penalización clamp 100 → score 0
    const muchos = Array.from({ length: 30 }, (_, i) =>
      h({ embarque_id: `c${i}`, severidad: "critico" }),
    );
    setData(muchos);
    const { result } = renderHook(() => useAuditoriaEjecutivo());
    expect(result.current.score).toBe(0);
    expect(result.current.scoreEstado).toBe("malo");
  });
});
