/**
 * Auditoría CRM — useOportunidadLineage debe propagar el error de CUALQUIERA
 * de sus 3 consultas (cotizaciones, embarques, lead) y refetch debe reintentar
 * las tres; un fallo no puede verse como "sin datos".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown) => useQueryMock(opts),
}));
vi.mock("@/features/crm/services", () => ({
  fetchLeadLineage: vi.fn(),
  fetchOportunidadCotsLineage: vi.fn(),
  fetchEmbarquesByIds: vi.fn(),
  fetchLeadResumen: vi.fn(),
}));

import { useOportunidadLineage } from "../useLineage";

interface QueryState {
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  refetch: () => void;
}

const ok = (data: unknown): QueryState => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

function configurarQueries(opts: { cotsError?: boolean; embsError?: boolean; leadError?: boolean }) {
  const refetches = { cots: vi.fn(), embs: vi.fn(), lead: vi.fn() };
  useQueryMock.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
    const key = queryKey.join("/");
    if (key.includes("cots")) {
      return { ...ok([{ id: "c-1", embarque_id: "e-1" }]), isError: !!opts.cotsError, refetch: refetches.cots };
    }
    if (key.includes("embs")) {
      return { ...ok([]), isError: !!opts.embsError, refetch: refetches.embs };
    }
    return { ...ok(null), isError: !!opts.leadError, refetch: refetches.lead };
  });
  return refetches;
}

beforeEach(() => {
  useQueryMock.mockReset();
});

describe("useOportunidadLineage — propagación de errores", () => {
  it("agrega el error de cotizaciones, embarques o lead", () => {
    for (const caso of [{ cotsError: true }, { embsError: true }, { leadError: true }]) {
      configurarQueries(caso);
      const { result, unmount } = renderHook(() => useOportunidadLineage("op-1", "l-1"));
      expect(result.current.isError).toBe(true);
      unmount();
    }
  });

  it("sin errores isError es false y conserva los datos", () => {
    configurarQueries({});
    const { result } = renderHook(() => useOportunidadLineage("op-1", "l-1"));
    expect(result.current.isError).toBe(false);
    expect(result.current.cots).toHaveLength(1);
  });

  it("refetch reintenta las tres consultas", () => {
    const refetches = configurarQueries({ embsError: true });
    const { result } = renderHook(() => useOportunidadLineage("op-1", "l-1"));
    result.current.refetch();
    expect(refetches.cots).toHaveBeenCalledTimes(1);
    expect(refetches.embs).toHaveBeenCalledTimes(1);
    expect(refetches.lead).toHaveBeenCalledTimes(1);
  });
});
