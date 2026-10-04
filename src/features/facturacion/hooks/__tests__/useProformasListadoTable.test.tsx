import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useProformasListadoTable } from "../useProformasListadoTable";
import { buildProformasColumns } from "../../components/proformasColumns";
import { proformaFixture } from "../../components/__tests__/fixtures/proforma";

describe("Orden financiero previo a la paginación", () => {
  it("un pendiente fuera de la página aparece al ordenar, manteniendo contexto y moneda", () => {
    const data = [
      proformaFixture({ id: "p100", total_mxn: 100, total_usd: 1 }),
      proformaFixture({ id: "p200", total_mxn: 200, total_usd: 2 }),
      proformaFixture({ id: "p1", expediente: "EXP-FUERA", total_mxn: 1, total_usd: 999 }),
    ];
    const columns = buildProformasColumns({});
    const onPageChange = vi.fn();
    const { result, rerender } = renderHook(({ page }) => useProformasListadoTable({
      data, columns, page, pageSize: 2, onPageChange,
    }), { initialProps: { page: 0 } });
    expect(result.current.data.map((p) => p.id)).toEqual(["p100", "p200"]);
    act(() => result.current.onSortChange("total_mxn", "asc"));
    expect(result.current.data.map((p) => p.id)).toEqual(["p1", "p100"]);
    expect(result.current.data[0]).toMatchObject({ expediente: "EXP-FUERA", total_mxn: 1, total_usd: 999 });
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    rerender({ page: 1 });
    expect(result.current.data.map((p) => p.id)).toEqual(["p200"]);
    act(() => result.current.onSortChange("total_usd", "desc"));
    rerender({ page: 0 });
    expect(result.current.data.map((p) => p.id)).toEqual(["p1", "p200"]);
  });
});
