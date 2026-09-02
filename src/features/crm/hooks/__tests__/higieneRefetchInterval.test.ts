/**
 * Las queries de Higiene deben refrescarse cada 60 s: los vencimientos de SLA
 * dependen del reloj y no de una mutación del usuario.
 */
import { describe, it, expect, vi } from "vitest";

const useQuery = vi.hoisted(() =>
  vi.fn((_opciones: { refetchInterval?: number }) => ({ data: undefined })),
);

vi.mock("@tanstack/react-query", () => ({
  useQuery,
  useMutation: vi.fn(() => ({ mutate: vi.fn() })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/features/crm/services", () => ({
  fetchHigieneResumen: vi.fn(),
  fetchHigieneOportunidades: vi.fn(),
  fetchPresupuestoAnio: vi.fn(),
  upsertPresupuestoMes: vi.fn(),
  fetchMetasActividad: vi.fn(),
  upsertMetaActividad: vi.fn(),
}));

import { useHigieneResumen, useHigieneOportunidades } from "../useHigienePipeline";

describe("refetchInterval de Higiene", () => {
  it("el resumen se refresca cada 60 s", () => {
    useQuery.mockClear();
    useHigieneResumen();
    expect(useQuery.mock.calls[0]?.[0]?.refetchInterval).toBe(60_000);
  });

  it("el detalle de oportunidades se refresca cada 60 s", () => {
    useQuery.mockClear();
    useHigieneOportunidades();
    expect(useQuery.mock.calls[0]?.[0]?.refetchInterval).toBe(60_000);
  });
});
