import { StrictMode, type PropsWithChildren } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";
import { useAutoSyncEstadoEmbarque } from "../useEmbarqueEstadoActions.internals";

const { sync } = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useSyncEstadoEmbarque: () => ({ mutate: sync }),
  calcularEstadoEmbarque: (...args: Parameters<typeof calcularEstadoEmbarque>) => calcularEstadoEmbarque(...args),
}));
vi.mock("@/features/embarques/hooks/useCierreEmbarque", () => ({ useValidacionCierre: vi.fn() }));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: vi.fn() }));

const base = {
  id: "s09", modo: "Marítimo", tipo: "Importación", estado: "Borrador",
  etd: "2026-09-15", eta: "2026-10-10", fecha_llegada_real: null,
};
type Input = NonNullable<Parameters<typeof useAutoSyncEstadoEmbarque>[0]>;
const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
beforeEach(() => { sync.mockClear(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T23:41:17Z")); });
afterEach(() => vi.useRealTimers());

describe("auto-sync real: ETD no emite segunda transición", () => {
  it("Borrador → Confirmado, refetch y remount nunca invocan RPC de salida", () => {
    const { rerender, unmount } = renderHook(
      ({ estado }) => useAutoSyncEstadoEmbarque({ ...base, estado } as Input, true, "operador@example.test"),
      { initialProps: { estado: "Borrador" }, wrapper },
    );
    rerender({ estado: "Confirmado" });
    rerender({ estado: "Confirmado" });
    unmount();
    renderHook(() => useAutoSyncEstadoEmbarque({ ...base, estado: "Confirmado" } as Input, true, "operador@example.test"), { wrapper });
    expect(sync).not.toHaveBeenCalled();
  });
  it("un zarpe confirmado explícitamente no se revierte por ETD futura", () => {
    renderHook(() => useAutoSyncEstadoEmbarque({ ...base, estado: "En Tránsito", etd: "2026-11-01", eta: "2026-11-10" } as Input, true, "operador@example.test"));
    expect(sync).not.toHaveBeenCalled();
  });
  it("mantiene sincronización de arribo con llegada real existente", () => {
    renderHook(() => useAutoSyncEstadoEmbarque({ ...base, estado: "En Tránsito", fecha_llegada_real: "2026-10-10" } as Input, true, "operador@example.test"));
    expect(sync).toHaveBeenCalledExactlyOnceWith({ embarqueId: "s09", nuevoEstado: "Arribo", usuarioEmail: "operador@example.test" });
  });
  it("sin permisos no sincroniza ni siquiera el arribo", () => {
    renderHook(() => useAutoSyncEstadoEmbarque({ ...base, estado: "En Tránsito", fecha_llegada_real: "2026-10-10" } as Input, false, "lector@example.test"));
    expect(sync).not.toHaveBeenCalled();
  });
});
