import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock nuqs before imports so the hook uses in-memory state
vi.mock("nuqs", async () => {
  const { useState } = await import("react");
  function useQueryState<T>(
    _key: string,
    parser: { withDefault: (d: T) => { defaultValue: T } } & { defaultValue?: T },
  ) {
    const def = typeof parser === "object" && "defaultValue" in parser
      ? (parser as { defaultValue: T }).defaultValue
      : (parser as { withDefault: (d: T) => { defaultValue: T } }).withDefault as unknown as T;
    const [val, setVal] = useState<T>(def);
    return [val, (v: T | null) => setVal(v ?? def)] as const;
  }
  function useQueryStates(parsers: Record<string, { defaultValue: string }>) {
    const defaults: Record<string, string> = {};
    for (const k of Object.keys(parsers)) defaults[k] = parsers[k].defaultValue;
    const [vals, setVals] = useState(defaults);
    return [vals, (patch: Record<string, string | null>) => {
      setVals((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(patch)) next[k] = v ?? defaults[k];
        return next;
      });
    }] as const;
  }
  const parseAsString = { withDefault: (d: string) => ({ defaultValue: d }) };
  const parseAsInteger = { withDefault: (d: number) => ({ defaultValue: d }) };
  return { useQueryState, useQueryStates, parseAsString, parseAsInteger };
});

import { useListPageState } from "../useListPageState";

describe("useListPageState", () => {
  it("expone valores por defecto", () => {
    const { result } = renderHook(() => useListPageState({ estado: "" }));
    expect(result.current.search).toBe("");
    expect(result.current.page).toBe(0);
    expect(result.current.pageSize).toBe(100);
    expect(result.current.filters.estado).toBe("");
  });

  it("setSearch actualiza search y resetea page", () => {
    const { result } = renderHook(() => useListPageState({ estado: "" }));
    act(() => { result.current.setPage(2); });
    act(() => { result.current.setSearch("ACME"); });
    expect(result.current.search).toBe("ACME");
    expect(result.current.page).toBe(0);
  });

  it("paginate() corta arrays correctamente", () => {
    const { result } = renderHook(() => useListPageState({}, 2));
    const items = [1, 2, 3, 4, 5];
    const { items: page0, totalPages } = result.current.paginate(items);
    expect(page0).toEqual([1, 2]);
    expect(totalPages).toBe(3);
  });
});
