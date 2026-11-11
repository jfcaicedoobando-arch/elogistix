import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbarquesPageState } from "../useEmbarquesPageState";

const m = vi.hoisted(() => ({ query: { data: { data: [], count: 46 }, isError: false, isLoading: false, isPlaceholderData: false } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ ...m.query, isSuccess: !m.query.isError && !m.query.isLoading }) }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-1", orgListo: true }), useDebounce: (value: string) => value }));
vi.mock("../useEmbarquesAlertasResumen", () => ({ useEmbarquesAlertasResumen: () => ({}) }));
vi.mock("../../queries", () => ({ embarqueQueries: { list: () => ({}) } }));

beforeEach(() => { m.query = { data: { data: [], count: 46 }, isError: false, isLoading: false, isPlaceholderData: false }; });
const wrapper = () => withNuqsTestingAdapter({ hasMemory: true, searchParams: "?page=1&estado=Confirmado&q=ACME" });

describe("recuperación del listado de embarques", () => {
  it("recupera una página fuera de rango sin borrar búsqueda ni estado", async () => {
    const { result } = renderHook(() => useEmbarquesPageState(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.page).toBe(0));
    expect(result.current.search).toBe("ACME");
    expect(result.current.filterEstado).toBe("Confirmado");
    expect(result.current.totalCount).toBe(46);
  });

  it.each(["isError", "isPlaceholderData"] as const)("no cambia la página con %s", (flag) => {
    m.query[flag] = true;
    const { result } = renderHook(() => useEmbarquesPageState(), { wrapper: wrapper() });
    expect(result.current.page).toBe(1);
  });

  it("restablece el orden predeterminado y la primera página", async () => {
    m.query.data.count = 1000;
    const { result } = renderHook(() => useEmbarquesPageState(), { wrapper: wrapper() });
    await act(async () => { result.current.handleSortChange("eta", "asc"); });
    await act(async () => { result.current.handleSortChange(null, "desc"); });
    expect(result.current.sortKey).toBe("expediente");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.page).toBe(0);
  });
});
