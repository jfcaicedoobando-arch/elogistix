/**
 * Tests del controller de la página de Auditoría: filtros, conteo de
 * revisados y agrupación por regla. Mockeamos los hooks de I/O.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type {
  AuditoriaRevision,
  HallazgoAuditoria,
  ReporteAuditoria,
} from "@/types/auditoria";

vi.mock("@/hooks/auditoria/useAuditoria", () => ({
  useAuditoria: vi.fn(),
  AUDITORIA_QUERY_KEY: ["auditoria", "embarques"],
}));
vi.mock("@/hooks/auditoria/useAuditoriaRevisiones", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/auditoria/useAuditoriaRevisiones")>(
    "@/hooks/auditoria/useAuditoriaRevisiones",
  );
  return { ...actual, useAuditoriaRevisiones: vi.fn() };
});
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

import { useAuditoria } from "@/hooks/auditoria/useAuditoria";
import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import { useAuditoriaPageController } from "@/hooks/auditoria/useAuditoriaPageController";

const mockUseAuditoria = vi.mocked(useAuditoria);
const mockUseRevisiones = vi.mocked(useAuditoriaRevisiones);

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

function setData(hallazgos: HallazgoAuditoria[], revisiones?: Map<string, AuditoriaRevision>) {
  const reporte: ReporteAuditoria = {
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
  mockUseAuditoria.mockReturnValue({
    data: reporte, isLoading: false, isFetching: false,
  } as unknown as ReturnType<typeof useAuditoria>);
  mockUseRevisiones.mockReturnValue({
    data: revisiones,
  } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
}

beforeEach(() => vi.clearAllMocks());

describe("useAuditoriaPageController", () => {
  it("oculta hallazgos revisados por defecto y los expone con mostrarRevisados=true", () => {
    const revisado = h({ embarque_id: "rev", regla: "docs_faltantes", detalle: "d1" });
    const pendiente = h({ embarque_id: "pen", regla: "fechas", detalle: "d2" });
    const map = new Map<string, AuditoriaRevision>();
    map.set(revisionKey(revisado), {
      id: "1", embarque_id: revisado.embarque_id, regla: revisado.regla,
      detalle_hash: "h", detalle: "d1", accion_tomada: null,
      revisado_por: null, revisado_por_email: null,
      estado_revision: "revisado",
      responsable_id: null, responsable_email: "",
      asignado_por: null, asignado_por_email: "",
      asignado_at: null, fecha_limite: null,
      snoozed_until: null, snooze_motivo: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-02T00:00:00Z",
    });
    setData([revisado, pendiente], map);

    const { result } = renderHook(() => useAuditoriaPageController());
    expect(result.current.hallazgosVisibles.map((x) => x.embarque_id)).toEqual(["pen"]);
    expect(result.current.revisadosCount).toBe(1);

    act(() => result.current.setMostrarRevisados(true));
    expect(result.current.hallazgosVisibles).toHaveLength(2);
  });

  it("aplica filtros por severidad y modo", () => {
    setData([
      h({ embarque_id: "1", severidad: "critico", modo: "Marítimo" }),
      h({ embarque_id: "2", severidad: "medio", modo: "Aéreo" }),
      h({ embarque_id: "3", severidad: "critico", modo: "Aéreo" }),
    ]);
    const { result } = renderHook(() => useAuditoriaPageController());

    act(() => result.current.setFiltroSev("critico"));
    expect(result.current.hallazgosFiltrados).toHaveLength(2);

    act(() => result.current.setFiltroModo("Aéreo"));
    expect(result.current.hallazgosFiltrados.map((x) => x.embarque_id)).toEqual(["3"]);
  });

  it("agrupa por regla y deja arrays vacíos para reglas sin hallazgos", () => {
    setData([
      h({ embarque_id: "1", regla: "margen_negativo" }),
      h({ embarque_id: "2", regla: "margen_negativo" }),
      h({ embarque_id: "3", regla: "fechas" }),
    ]);
    const { result } = renderHook(() => useAuditoriaPageController());
    expect(result.current.porRegla.margen_negativo).toHaveLength(2);
    expect(result.current.porRegla.fechas).toHaveLength(1);
    expect(result.current.porRegla.docs_faltantes).toEqual([]);
  });

  it("kpiSeveridad refleja los hallazgos visibles (no filtrados por sev)", () => {
    setData([
      h({ embarque_id: "1", severidad: "critico" }),
      h({ embarque_id: "2", severidad: "alto" }),
      h({ embarque_id: "3", severidad: "alto" }),
    ]);
    const { result } = renderHook(() => useAuditoriaPageController());
    expect(result.current.kpiSeveridad).toEqual({ critico: 1, alto: 2, medio: 0 });
  });

  it("modos retorna lista única ordenada", () => {
    setData([
      h({ embarque_id: "1", modo: "Marítimo" }),
      h({ embarque_id: "2", modo: "Aéreo" }),
      h({ embarque_id: "3", modo: "Marítimo" }),
    ]);
    const { result } = renderHook(() => useAuditoriaPageController());
    expect(result.current.modos).toEqual(["Aéreo", "Marítimo"]);
  });
});
