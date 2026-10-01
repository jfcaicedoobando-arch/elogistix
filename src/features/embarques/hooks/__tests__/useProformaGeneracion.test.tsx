import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProformaGeneracion } from "../useProformaGeneracion";
import type { SubmitProformaParams } from "../../services/submitProformaDialog";
import { generarPdfProforma } from "@/generators/proformaPdf";

vi.mock("@/generators/proformaPdf", () => ({ generarPdfProforma: vi.fn().mockResolvedValue(undefined) }));

function params(): SubmitProformaParams {
  return {
    embarque: { id: "mock-e", cliente_id: "mock-cli", cliente_nombre: "Aceros Monterrey", expediente: "ELNAC-MOCK" } as SubmitProformaParams["embarque"],
    conceptosSeleccionados: [{ id: "A", descripcion: "Flete local", cantidad: 1, precio_unitario: 100, moneda: "MXN", tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, aplica_iva: true } as SubmitProformaParams["conceptosSeleccionados"][0]],
    seleccionados: new Set(["A"]), notas: "Entrega en Apodaca", diasCredito: "30", filtroContenedor: "todos", contenedores: [], tasaIva: 0.16,
    totales: { subtotal_usd: 0, iva_usd: 0, total_usd: 0, subtotal_mxn: 100, iva_mxn: 16, total_mxn: 116 },
    crearProformaMutateAsync: vi.fn().mockResolvedValue({ id: "proforma-A", numero: "PRO-MOCK-A" }),
    fetchClienteParaPdfCached: vi.fn().mockResolvedValue(null),
  };
}

describe("proforma: commit y descarga son fases diferentes", () => {
  it("un fallo post-commit reintenta sólo el PDF de A, aunque B llegue por refetch", async () => {
    const p = params();
    vi.mocked(p.fetchClienteParaPdfCached).mockRejectedValueOnce(new Error("PDF no disponible"));
    const { result } = renderHook(() => useProformaGeneracion());
    await act(async () => { await expect(result.current.ejecutar(p)).rejects.toThrow("PDF no disponible"); });
    expect(result.current.creada?.proforma.id).toBe("proforma-A");
    // La lista pendiente ahora trae B; jamás se usa para volver a crear A.
    const b = { ...p, conceptosSeleccionados: [{ ...p.conceptosSeleccionados[0], id: "B" }], seleccionados: new Set(["B"]), notas: "Otra nota" };
    await act(async () => { expect(await result.current.ejecutar(b)).toBe(true); });
    expect(p.crearProformaMutateAsync).toHaveBeenCalledTimes(1);
    expect(generarPdfProforma).toHaveBeenCalledWith(expect.objectContaining({
      proforma: expect.objectContaining({ id: "proforma-A" }),
      conceptos: [expect.objectContaining({ id: "A" })], notas: "Entrega en Apodaca",
    }));
  });

  it("evita doble clic durante la descarga, no sólo durante la RPC", async () => {
    const p = params();
    let resolver!: (value: null) => void;
    vi.mocked(p.fetchClienteParaPdfCached).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
    const { result } = renderHook(() => useProformaGeneracion());
    let tarea!: Promise<boolean>;
    await act(async () => { tarea = result.current.ejecutar(p); await Promise.resolve(); });
    expect(result.current.isPending).toBe(true);
    await act(async () => { expect(await result.current.ejecutar(p)).toBe(false); });
    expect(p.crearProformaMutateAsync).toHaveBeenCalledTimes(1);
    await act(async () => { resolver(null); await tarea; });
    expect(result.current.isPending).toBe(false);
  });
});
