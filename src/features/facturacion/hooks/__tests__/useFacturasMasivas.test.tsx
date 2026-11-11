import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAs } from "file-saver";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { facturas } from "../../queryKeys";
import { marcarFacturasComoEnviadas } from "../../services/masivas";
import { generarZipFacturas } from "../../services/masivasZip";
import { useFacturasMasivas } from "../useFacturasMasivas";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
}));
vi.mock("../../services/masivas", () => ({
  marcarFacturasComoEnviadas: vi.fn(),
  reenviarFacturasMasivas: vi.fn(),
}));
vi.mock("../../services/masivasZip", () => ({ generarZipFacturas: vi.fn() }));

function preparar() {
  const qc = new QueryClient();
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const { result } = renderHook(() => {
    const selection = useRowSelection();
    const acciones = useFacturasMasivas(selection.selectedIds, selection.remove);
    return { selection, acciones };
  }, {
    wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  });
  act(() => result.current.selection.onSelectionChange(new Set(["a", "b"])));
  return { result, invalidar };
}

describe("useFacturasMasivas", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("desmarca sólo las facturas confirmadas y refresca la lista", async () => {
    vi.mocked(marcarFacturasComoEnviadas).mockResolvedValue([
      { facturaId: "a", ok: true },
      { facturaId: "b", ok: false, error: "No se confirmó el marcado" },
    ]);
    const { result, invalidar } = preparar();
    await act(async () => { await result.current.acciones.marcarEnviada(); });

    expect(result.current.selection.selectedIds).toEqual(new Set(["b"]));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: facturas.all });
    expect(notifyWarning).toHaveBeenCalledWith(undefined, expect.objectContaining({
      context: { facturaIdsSinConfirmar: ["b"] },
    }));
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("guarda el ZIP parcial y muestra qué documento falta", async () => {
    const archivo = new Blob(["zip"]);
    vi.mocked(generarZipFacturas).mockResolvedValue({
      archivo,
      facturas: [
        { facturaId: "a", numero: "F-1", incluidos: ["pdf", "xml"], faltantes: [] },
        { facturaId: "b", numero: "F-2", incluidos: ["xml"], faltantes: ["pdf"] },
      ],
    });
    const { result, invalidar } = preparar();
    await act(async () => { await result.current.acciones.descargarZip(); });

    expect(saveAs).toHaveBeenCalledWith(archivo, expect.stringMatching(/^facturas-.*\.zip$/));
    expect(notifyWarning).toHaveBeenCalledWith(undefined, expect.objectContaining({
      description: "F-2: falta PDF",
    }));
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
  });
});
