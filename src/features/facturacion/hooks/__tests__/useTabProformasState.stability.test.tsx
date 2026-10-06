import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemo } from "react";
import { proformaFixture } from "../../components/__tests__/fixtures/proforma";
import { buildProformasColumns } from "../../components/proformasColumns";
import { useTabProformasState } from "../useTabProformasState";
import { useTabProformasController } from "../useTabProformasController";
import { useProformasListadoTable } from "../useProformasListadoTable";

// Only remote data/PDF boundaries are stubbed. Filtering, selection, columns
// and TanStack's automatic page reset run exactly as in TabProformas.
vi.mock("@/features/embarques/hooks/useProformas", () => ({ useProformas: vi.fn() }));
vi.mock("@/features/embarques/hooks/useDescargarProformaPdf", () => ({
  useDescargarProformaPdf: () => ({ descargar: vi.fn(), downloadingId: null }),
}));
import { useProformas } from "@/features/embarques/hooks/useProformas";

const data = Array.from({ length: 5 }, (_, index) => proformaFixture({
  id: `synthetic-${index}`, numero: `P-${index}`, estado_cliente: "aceptada",
  fecha_emision: index < 3 ? "2024-01-05" : "2024-02-05",
  total_mxn: (index + 1) * 100, total_usd: index + 1,
}));

describe("Proforma filter identity (audit 138)", () => {
  const network = vi.fn(() => { throw new Error("Network is forbidden in this isolated regression"); });
  beforeEach(() => { vi.stubGlobal("fetch", network); });
  afterEach(() => {
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("keeps derived references on unrelated renders, page and page-size changes without a date predicate", () => {
    const { result, rerender } = renderHook(() => useTabProformasState(data));
    const { filtered, counts } = result.current;
    rerender();
    expect(result.current.filtered).toBe(filtered);
    expect(result.current.counts).toBe(counts);
    act(() => result.current.setPageSize(2));
    act(() => result.current.setPage(1));
    expect(result.current.filtered).toBe(filtered);
    expect(result.current.paginated.map((p) => p.id)).toEqual(["synthetic-2", "synthetic-3"]);
  });

  it("recomputes when the supplied date predicate or source data changes", () => {
    type Predicate = (date: string | null | undefined) => boolean;
    const january: Predicate = (date) => date?.startsWith("2024-01") ?? false;
    const february: Predicate = (date) => date?.startsWith("2024-02") ?? false;
    const { result, rerender } = renderHook(
      ({ rows, predicate }: { rows: typeof data; predicate?: Predicate }) => useTabProformasState(rows, predicate),
      { initialProps: { rows: data, predicate: undefined as Predicate | undefined } },
    );
    const all = result.current.filtered;
    rerender({ rows: data, predicate: january });
    expect(result.current.filtered).toHaveLength(3);
    expect(result.current.filtered).not.toBe(all);
    const firstMonth = result.current.filtered;
    rerender({ rows: data, predicate: january });
    expect(result.current.filtered).toBe(firstMonth);
    rerender({ rows: data, predicate: february });
    expect(result.current.filtered).toHaveLength(2);
    rerender({ rows: data.slice(0, 4), predicate: february });
    expect(result.current.filtered).toHaveLength(1);
    rerender({ rows: data, predicate: undefined });
    expect(result.current.filtered).toHaveLength(5);
  });

  it("settles after select/deselect/all/clear, filters, sorting, paging and back with the real table", async () => {
    vi.mocked(useProformas).mockReturnValue({ data, isLoading: false } as ReturnType<typeof useProformas>);
    let renders = 0;
    const { result, rerender, unmount } = renderHook(() => {
      // Bound the original microtask reset loop instead of hanging CI.
      if (++renders > 60) throw new Error("Proforma table did not settle after 60 renders");
      const controller = useTabProformasController();
      const columns = useMemo(() => buildProformasColumns({ selection: {
        selectedIds: controller.selectedIds, toggle: controller.toggleSelected,
        isSelectable: controller.isConvertible,
      } }), [controller.selectedIds, controller.toggleSelected, controller.isConvertible]);
      const table = useProformasListadoTable({ data: controller.filtered, columns,
        page: controller.page, pageSize: controller.pageSize, onPageChange: controller.setPage });
      return { controller, table };
    });
    const change = async (action: () => void) => { await act(async () => { action(); }); };
    await act(async () => {});
    const filtered = result.current.controller.filtered;
    await change(() => result.current.controller.toggleSelected(data[0].id));
    expect(result.current.controller.selectedProformas).toEqual([data[0]]);
    expect(result.current.controller.filtered).toBe(filtered);
    await change(() => result.current.controller.toggleSelected(data[0].id));
    expect(result.current.controller.selectedProformas).toHaveLength(0);
    await change(() => data.forEach((row) => result.current.controller.toggleSelected(row.id)));
    expect(result.current.controller.selectedProformas).toHaveLength(5);
    await change(() => result.current.controller.clearSelected());
    expect(result.current.controller.selectedIds.size).toBe(0);
    await change(() => result.current.controller.setPageSize(2));
    await change(() => result.current.controller.setPage(1));
    expect(result.current.table.data.map((row) => row.id)).toEqual(["synthetic-2", "synthetic-3"]);
    await change(() => result.current.controller.setPage(0));
    await change(() => result.current.table.onSortChange("total_mxn", "desc"));
    expect(result.current.table.data.map((row) => row.total_mxn)).toEqual([500, 400]);
    await change(() => result.current.controller.setPage(1));
    await change(() => result.current.controller.setSearch("P-0"));
    expect(result.current.controller.page).toBe(0);
    expect(result.current.table.data).toEqual([data[0]]);
    await change(() => result.current.controller.setSearch(""));
    await change(() => result.current.controller.setFechaHasta("2024-01-31"));
    expect(result.current.controller.filtered).toHaveLength(3);
    await change(() => result.current.controller.clearFiltros());
    expect(result.current.controller.filtered).toHaveLength(5);
    await change(() => rerender());
    const settled = renders;
    await act(async () => {});
    expect(renders).toBe(settled);
    expect(renders).toBeLessThan(40);
    unmount();
  });
});
