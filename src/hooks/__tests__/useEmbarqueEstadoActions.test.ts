import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const toast = vi.fn();
const registrarActividadMutate = vi.fn();
const avanzarEstadoMutateAsync = vi.fn();
const syncEstadoMutate = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tester@example.com" } }),
}));

vi.mock("@/hooks/useBitacora", () => ({
  useRegistrarActividad: () => ({ mutate: registrarActividadMutate }),
}));

vi.mock("@/hooks/useEmbarques", async () => {
  const actual = await vi.importActual<typeof import("@/lib/domain/embarque")>("@/lib/domain/embarque");
  return {
    useAvanzarEstadoEmbarque: () => ({ mutateAsync: avanzarEstadoMutateAsync }),
    useSyncEstadoEmbarque: () => ({ mutate: syncEstadoMutate }),
    calcularEstadoEmbarque: actual.calcularEstadoEmbarque,
  };
});

import { useEmbarqueEstadoActions, getSiguienteEstado } from "@/hooks/useEmbarqueEstadoActions";

type Embarque = {
  id: string;
  modo: string;
  tipo: string;
  etd: string | null;
  eta: string | null;
  estado: string;
  expediente: string;
};

function makeEmbarque(over: Partial<Embarque> = {}): Embarque {
  return {
    id: "emb-1",
    modo: "Marítimo",
    tipo: "Importación",
    etd: "2026-04-01",
    eta: "2026-04-10",
    estado: "Confirmado",
    expediente: "IMP-001",
    ...over,
  };
}

describe("getSiguienteEstado", () => {
  it("retorna el siguiente en la secuencia", () => {
    expect(getSiguienteEstado("Confirmado")).toBe("En Tránsito");
    expect(getSiguienteEstado("En Tránsito")).toBe("Arribo");
  });

  it("retorna null si es el último", () => {
    expect(getSiguienteEstado("Cerrado")).toBeNull();
  });

  it("retorna null si no existe", () => {
    expect(getSiguienteEstado("XYZ")).toBeNull();
  });
});

describe("useEmbarqueEstadoActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-sincroniza estado calculado distinto al actual", async () => {
    // estado="Confirmado" pero ETD/ETA en pasado → calculado=Arribo
    const embarque = makeEmbarque({ etd: "2026-01-01", eta: "2026-01-10", estado: "Confirmado" });
    renderHook(() => useEmbarqueEstadoActions(embarque as never, "emb-1"));
    await waitFor(() => {
      expect(syncEstadoMutate).toHaveBeenCalledWith({ embarqueId: "emb-1", nuevoEstado: "Arribo" });
    });
  });

  it("no sincroniza si estado calculado coincide con el actual", async () => {
    const embarque = makeEmbarque({ etd: "2030-01-01", eta: "2030-02-01", estado: "Confirmado" });
    renderHook(() => useEmbarqueEstadoActions(embarque as never, "emb-1"));
    await new Promise(r => setTimeout(r, 0));
    expect(syncEstadoMutate).not.toHaveBeenCalled();
  });

  it("no hace nada si no hay embarque", () => {
    renderHook(() => useEmbarqueEstadoActions(undefined, "emb-1"));
    expect(syncEstadoMutate).not.toHaveBeenCalled();
  });

  it("handleAvanzarEstado: avanza, registra y notifica", async () => {
    avanzarEstadoMutateAsync.mockResolvedValueOnce(undefined);
    const embarque = makeEmbarque({ estado: "Confirmado" });
    const { result } = renderHook(() => useEmbarqueEstadoActions(embarque as never, "emb-1"));
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(avanzarEstadoMutateAsync).toHaveBeenCalledWith({
      embarqueId: "emb-1",
      nuevoEstado: "En Tránsito",
      usuarioEmail: "tester@example.com",
    });
    expect(registrarActividadMutate).toHaveBeenCalledWith(expect.objectContaining({
      accion: "cambiar_estado",
      modulo: "embarques",
    }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("En Tránsito"),
    }));
  });

  it("handleAvanzarEstado: no hace nada si está en último estado", async () => {
    const embarque = makeEmbarque({ estado: "Cerrado" });
    const { result } = renderHook(() => useEmbarqueEstadoActions(embarque as never, "emb-1"));
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(avanzarEstadoMutateAsync).not.toHaveBeenCalled();
  });

  it("handleAvanzarEstado: muestra toast de error si falla", async () => {
    avanzarEstadoMutateAsync.mockRejectedValueOnce(new Error("network"));
    const embarque = makeEmbarque({ estado: "Confirmado" });
    const { result } = renderHook(() => useEmbarqueEstadoActions(embarque as never, "emb-1"));
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(registrarActividadMutate).not.toHaveBeenCalled();
  });
});
