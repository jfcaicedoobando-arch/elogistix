/**
 * FP-000221 — el lote pide la justificación cuando alguna seleccionada no está
 * ligada a un embarque, y sólo la manda a esas facturas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { aprobarMock } = vi.hoisted(() => ({
  aprobarMock: vi.fn().mockResolvedValue({ id: "x" }),
}));
vi.mock("@/features/cxp/services/aprobacionFactura", async () => {
  const real = await vi.importActual<typeof import("@/features/cxp/services/aprobacionFactura")>(
    "@/features/cxp/services/aprobacionFactura",
  );
  return { ...real, aprobarFacturaProveedor: aprobarMock };
});
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

import { ConfirmarAprobacionLoteDialog } from "../ComprasPorAprobar.confirmDialog";
import { useAprobarFacturasLote } from "@/features/cxp/hooks/useAprobarFacturasLote";
import { renderHook, waitFor } from "@testing-library/react";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("Aprobación en lote con justificación", () => {
  beforeEach(() => {
    aprobarMock.mockClear();
  });

  it("bloquea el botón con menos de 10 caracteres y lo habilita al cumplir", () => {
    const { rerender } = render(
      <ConfirmarAprobacionLoteDialog
        open
        onOpenChange={() => {}}
        cantidad={2}
        totalMxn={100}
        totalUsd={0}
        isRunning={false}
        requierenJustificacion={1}
        justificacion="corto"
        onJustificacionChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Aprobar 2/ })).toBeDisabled();

    rerender(
      <ConfirmarAprobacionLoteDialog
        open
        onOpenChange={() => {}}
        cantidad={2}
        totalMxn={100}
        totalUsd={0}
        isRunning={false}
        requierenJustificacion={1}
        justificacion="Renta de oficina de agosto"
        onJustificacionChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Aprobar 2/ })).toBeEnabled();
  });

  it("no pide justificación cuando todas están ligadas a un embarque", () => {
    render(
      <ConfirmarAprobacionLoteDialog
        open
        onOpenChange={() => {}}
        cantidad={1}
        totalMxn={100}
        totalUsd={0}
        isRunning={false}
        requierenJustificacion={0}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/Justificación del gasto/)).toBeNull();
    expect(screen.getByRole("button", { name: /Aprobar 1/ })).toBeEnabled();
  });

  it("captura el texto escrito", () => {
    const onChange = vi.fn();
    render(
      <ConfirmarAprobacionLoteDialog
        open
        onOpenChange={() => {}}
        cantidad={1}
        totalMxn={0}
        totalUsd={0}
        isRunning={false}
        requierenJustificacion={1}
        justificacion=""
        onJustificacionChange={onChange}
        onConfirm={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Renta de oficina" } });
    expect(onChange).toHaveBeenCalledWith("Renta de oficina");
  });

  it("manda la justificación sólo a las facturas sin embarque", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAprobarFacturasLote(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    await result.current.aprobar([A, B], {
      justificacion: "  Renta de oficina de agosto  ",
      requierenJustificacion: new Set([B]),
    });

    await waitFor(() => expect(aprobarMock).toHaveBeenCalledTimes(2));
    expect(aprobarMock).toHaveBeenNthCalledWith(1, A, true, undefined);
    expect(aprobarMock).toHaveBeenNthCalledWith(2, B, true, "Renta de oficina de agosto");
  });
});
