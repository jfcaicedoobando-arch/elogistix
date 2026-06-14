import { describe, it, expect, vi } from "vitest";
import { submitProformaDialog, type SubmitProformaParams } from "../submitProformaDialog";

const baseEmbarque = { id: "e-1", cliente_id: "cli-1", cliente_nombre: "ACME", expediente: "EXP-001", bl_master: null } as Parameters<typeof submitProformaDialog>[0]["embarque"];

const baseTotales = { subtotal_usd: 100, iva_usd: 16, total_usd: 116, subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0 };

function makeParams(overrides: Partial<SubmitProformaParams> = {}): SubmitProformaParams {
  return {
    embarque: baseEmbarque,
    conceptosSeleccionados: [{ id: "cv-1", moneda: "USD", cantidad: 1, precio_unitario: 100, aplica_iva: true } as Parameters<typeof submitProformaDialog>[0]["conceptosSeleccionados"][0]],
    seleccionados: new Set(["cv-1"]),
    ivaPorConcepto: { "cv-1": true },
    notas: "",
    diasCredito: "30",
    filtroContenedor: "todos",
    contenedores: [],
    totales: baseTotales,
    tasaIva: 0.16,
    crearProformaMutateAsync: vi.fn().mockResolvedValue({ id: "pf-1" }),
    fetchClienteParaPdfCached: vi.fn().mockResolvedValue({ id: "cli-1", nombre: "ACME" }),
    ...overrides,
  };
}

vi.mock("@/generators/proformaPdf", () => ({
  generarPdfProforma: vi.fn().mockResolvedValue(undefined),
}));

describe("submitProformaDialog", () => {
  it("llama crearProformaMutateAsync con los parámetros correctos", async () => {
    const params = makeParams();
    await submitProformaDialog(params);
    expect(params.crearProformaMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ embarqueId: "e-1", clienteId: "cli-1" }),
    );
  });

  it("añade etiqueta de contenedor a las notas cuando filtroContenedor no es 'todos'", async () => {
    const params = makeParams({
      filtroContenedor: "cont-1",
      contenedores: [{ id: "cont-1", numero_contenedor: "MSCU001", orden: 1 } as Parameters<typeof submitProformaDialog>[0]["contenedores"][0]],
      notas: "Nota extra",
    });
    await submitProformaDialog(params);
    const llamada = vi.mocked(params.crearProformaMutateAsync).mock.calls[0][0];
    expect(llamada.notas).toContain("MSCU001");
    expect(llamada.notas).toContain("Nota extra");
  });

  it("propaga el error si crearProformaMutateAsync rechaza", async () => {
    const params = makeParams({
      crearProformaMutateAsync: vi.fn().mockRejectedValue(new Error("DB fail")),
    });
    await expect(submitProformaDialog(params)).rejects.toThrow("DB fail");
  });
});
