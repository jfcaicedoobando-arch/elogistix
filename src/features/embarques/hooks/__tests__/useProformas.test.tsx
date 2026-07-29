import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/hooks/shared", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/shared")>("@/hooks/shared");
  return {
    ...actual,
    useOrgFilter: () => ({ organizationId: "org-1" }),
    toast: vi.fn(),
  };
});

const aprobadas = [{ id: "p1", numero: "P-001", estado_proforma: "aprobada" }];
const fetchProformasTodas = vi.fn().mockResolvedValue(aprobadas);
const crearProforma = vi.fn().mockResolvedValue({ id: "prof-1", numero: "P-1", embarque_id: "e-1" });

vi.mock("@/features/proformas/services", () => ({
  fetchProformasEmbarque: vi.fn().mockResolvedValue([]),
  fetchProformasTodas: (...args: unknown[]) => fetchProformasTodas(...args),
  fetchProformasPendientes: vi.fn().mockResolvedValue([]),
  crearProforma: (...args: unknown[]) => crearProforma(...args),
  aprobarProformas: vi.fn().mockResolvedValue(undefined),
  consolidarProformas: vi.fn().mockResolvedValue({ id: "prof-2", numero: "P-2", embarque_id: "e-1" }),
  eliminarProforma: vi.fn().mockResolvedValue(undefined),
  marcarProformaFacturada: vi.fn().mockResolvedValue(undefined),
}));

import { useProformas, useCrearProforma } from "../useProformas";

describe("useProformas", () => {
  it("ejecuta el query y devuelve la lista completa de proformas de la org", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProformas(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchProformasTodas).toHaveBeenCalledWith("org-1");
    expect(result.current.data).toEqual(aprobadas);
  });

  it("useCrearProforma inyecta organizationId y invoca el servicio al mutar", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrearProforma(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "e-1" } as never);
    });
    expect(crearProforma).toHaveBeenCalledTimes(1);
    expect(crearProforma.mock.calls[0][0]).toMatchObject({ embarqueId: "e-1", organizationId: "org-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
