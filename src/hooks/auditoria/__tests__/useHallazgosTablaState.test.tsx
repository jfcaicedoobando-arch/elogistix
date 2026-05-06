/**
 * Tests del hook de estado de la tabla de hallazgos: foco en drill-down
 * (initialSeveridad, initialCliente, initialSearch, soloVencidos) y filtros
 * por revisión/responsable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type {
  AuditoriaRevision,
  HallazgoAuditoria,
} from "@/types/auditoria";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/hooks/auditoria/useAuditoriaRevisiones", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/auditoria/useAuditoriaRevisiones")>(
    "@/hooks/auditoria/useAuditoriaRevisiones",
  );
  return { ...actual, useAuditoriaRevisiones: vi.fn() };
});

import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import { useHallazgosTablaState } from "@/hooks/auditoria/useHallazgosTablaState";

const mockUseRev = vi.mocked(useAuditoriaRevisiones);

function h(p: Partial<HallazgoAuditoria>): HallazgoAuditoria {
  return {
    embarque_id: "e",
    expediente: "EXP-001",
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
});

describe("useHallazgosTablaState — drill-down", () => {
  it("aplica initialSeveridad y initialCliente al montar", () => {
    const datos = [
      h({ embarque_id: "1", severidad: "critico", cliente_nombre: "ACME" }),
      h({ embarque_id: "2", severidad: "medio", cliente_nombre: "ACME" }),
      h({ embarque_id: "3", severidad: "critico", cliente_nombre: "Globex" }),
    ];
    const { result } = renderHook(() =>
      useHallazgosTablaState(datos, false, {
        initialSeveridad: "critico",
        initialCliente: "ACME",
      }),
    );
    expect(result.current.filtrados.map((x) => x.embarque_id)).toEqual(["1"]);
    expect(result.current.hayFiltros).toBe(true);
  });

  it("initialSearch filtra por expediente (case-insensitive)", () => {
    const datos = [
      h({ embarque_id: "1", expediente: "MX-2026-001" }),
      h({ embarque_id: "2", expediente: "AR-2026-002" }),
    ];
    const { result } = renderHook(() =>
      useHallazgosTablaState(datos, false, { initialSearch: "mx" }),
    );
    expect(result.current.filtrados.map((x) => x.embarque_id)).toEqual(["1"]);
  });

  it("soloVencidos pre-establece etaHasta = hoy y deja sólo ETAs pasadas", () => {
    const today = new Date();
    const offset = (d: number) => {
      const x = new Date(today); x.setDate(x.getDate() + d);
      return x.toISOString().slice(0, 10);
    };
    const datos = [
      h({ embarque_id: "vencido", eta: offset(-3) }),
      h({ embarque_id: "futuro", eta: offset(5) }),
      h({ embarque_id: "sin_eta", eta: null }),
    ];
    const { result } = renderHook(() =>
      useHallazgosTablaState(datos, false, { soloVencidos: true }),
    );
    expect(result.current.filtrados.map((x) => x.embarque_id)).toEqual(["vencido"]);
  });

  it("filtroResponsable='mios' deja sólo hallazgos asignados al usuario", () => {
    const mio = h({ embarque_id: "mio", regla: "fechas", detalle: "d1" });
    const ajeno = h({ embarque_id: "ajeno", regla: "fechas", detalle: "d2" });
    const map = new Map<string, AuditoriaRevision>();
    const baseRev = {
      detalle_hash: "h", accion_tomada: null, revisado_por: null,
      revisado_por_email: null, estado_revision: "pendiente" as const,
      asignado_por: null, asignado_por_email: "",
      asignado_at: null, fecha_limite: null,
      snoozed_until: null, snooze_motivo: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-02T00:00:00Z",
    };
    map.set(revisionKey(mio), {
      ...baseRev, id: "1",
      embarque_id: mio.embarque_id, regla: mio.regla, detalle: mio.detalle,
      responsable_id: "user-1", responsable_email: "me@x.mx",
    });
    map.set(revisionKey(ajeno), {
      ...baseRev, id: "2",
      embarque_id: ajeno.embarque_id, regla: ajeno.regla, detalle: ajeno.detalle,
      responsable_id: "user-other", responsable_email: "other@x.mx",
    });
    mockUseRev.mockReturnValue({ data: map } as unknown as ReturnType<typeof useAuditoriaRevisiones>);

    const { result } = renderHook(() =>
      useHallazgosTablaState([mio, ajeno], false, { initialResponsable: "mios" }),
    );
    expect(result.current.filtrados.map((x) => x.embarque_id)).toEqual(["mio"]);
  });

  it("paginación: respeta pageSize y totalPages", () => {
    const datos = Array.from({ length: 75 }, (_, i) =>
      h({ embarque_id: `e${i}`, expediente: `EXP-${i}` }),
    );
    const { result } = renderHook(() => useHallazgosTablaState(datos, false));
    expect(result.current.totalPages).toBe(2); // 75 / 50 (default)
    expect(result.current.visibles).toHaveLength(50);
  });

  it("clientes únicos ordenados alfabéticamente (es-MX)", () => {
    const datos = [
      h({ embarque_id: "1", cliente_nombre: "Zapata" }),
      h({ embarque_id: "2", cliente_nombre: "Álvarez" }),
      h({ embarque_id: "3", cliente_nombre: "Méndez" }),
      h({ embarque_id: "4", cliente_nombre: "Álvarez" }),
    ];
    const { result } = renderHook(() => useHallazgosTablaState(datos, false));
    expect(result.current.clientes).toEqual(["Álvarez", "Méndez", "Zapata"]);
  });
});
