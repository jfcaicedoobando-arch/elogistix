/**
 * Paso 4 de la auditoría · correcciones de estado/guard del borrador de NC:
 * - reapertura limpia TODO el draft con los sugeridos más recientes;
 * - un refetch con el modal abierto NO pisa la captura;
 * - `handleSubmit(true)` sin UUID no crea nada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { silenciarLogEsperado } from "@/test/helpers/silenciarLogEsperado";

const mocks = vi.hoisted(() => ({
  crearNotaCredito: vi.fn(),
  timbrarMutate: vi.fn(),
  notifyError: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/facturacion/services/notasCredito", () => ({
  crearNotaCredito: mocks.crearNotaCredito,
}));
vi.mock("@/features/facturacion/hooks/useNotaCreditoFacturapi", () => ({
  useTimbrarNotaCredito: () => ({ mutateAsync: mocks.timbrarMutate }),
}));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.notifyError }));

import { useNotaCreditoDraft } from "../useNotaCreditoDraft";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const sugerido = (descripcion: string, precio: number): ConceptoNotaCredito => ({
  descripcion,
  cantidad: 1,
  precio_unitario: precio,
  clave_sat: "84111506",
  clave_unidad: "E48",
  unidad: "u",
  tasa_iva: 0.16,
  tipo_iva: "gravado_16",
});

const onOpenChange = vi.fn();
const baseParams = {
  open: true,
  onOpenChange,
  facturaId: "fact-1",
  saldoFactura: 10_000,
  uuidFacturaOriginal: "UUID-1" as string | null,
  monedaFactura: "MXN" as const,
  tipoCambioFactura: 1,
};

beforeEach(() => {
  mocks.crearNotaCredito.mockReset().mockResolvedValue({ id: "nc-1" });
  mocks.timbrarMutate.mockReset().mockResolvedValue(undefined);
  mocks.notifyError.mockReset();
  mocks.toast.mockReset();
  onOpenChange.mockReset();
});

describe("useNotaCreditoDraft · ciclo abierto/cerrado", () => {
  it("montaje con open=true se inicializa con los sugeridos", () => {
    const { result } = renderHook(
      () => useNotaCreditoDraft({ ...baseParams, conceptosSugeridos: [sugerido("Flete", 100)] }),
      { wrapper },
    );
    expect(result.current.conceptos).toHaveLength(1);
    expect(result.current.conceptos[0].descripcion).toBe("Flete");
    expect(result.current.descripcion).toBe("");
  });

  it("cerrar y reabrir limpia TODOS los campos y toma los sugeridos más recientes", () => {
    const { result, rerender } = renderHook(
      (props: { open: boolean; conceptosSugeridos: ConceptoNotaCredito[] }) =>
        useNotaCreditoDraft({ ...baseParams, ...props }),
      { wrapper, initialProps: { open: true, conceptosSugeridos: [sugerido("Flete", 100)] } },
    );

    act(() => {
      result.current.setDescripcion("Descuento comercial");
      result.current.setMotivo("Devolución");
      result.current.setFecha("2020-01-01");
      result.current.setFormaPago("03");
    });
    expect(result.current.descripcion).toBe("Descuento comercial");

    rerender({ open: false, conceptosSugeridos: [sugerido("Flete", 100)] });
    rerender({ open: true, conceptosSugeridos: [sugerido("Maniobras", 200)] });

    expect(result.current.descripcion).toBe("");
    expect(result.current.motivo).toBe("Descuento");
    expect(result.current.fecha).not.toBe("2020-01-01");
    expect(result.current.formaPago).toBe("15");
    expect(result.current.conceptos[0].descripcion).toBe("Maniobras");
  });

  it("un refetch de sugeridos con el modal abierto NO borra la captura", () => {
    const { result, rerender } = renderHook(
      (props: { conceptosSugeridos: ConceptoNotaCredito[] }) =>
        useNotaCreditoDraft({ ...baseParams, ...props }),
      { wrapper, initialProps: { conceptosSugeridos: [sugerido("Flete", 100)] } },
    );

    act(() => {
      result.current.setDescripcion("Mi captura");
      result.current.setConceptos([sugerido("Editado a mano", 777)]);
    });

    // Nueva identidad del arreglo (refetch) con el modal abierto.
    rerender({ conceptosSugeridos: [sugerido("Flete", 100)] });

    expect(result.current.descripcion).toBe("Mi captura");
    expect(result.current.conceptos[0].descripcion).toBe("Editado a mano");
  });
});

describe("useNotaCreditoDraft · guard de timbrado", () => {
  it("handleSubmit(true) sin UUID no crea ni timbra", async () => {
    const { result } = renderHook(
      () => useNotaCreditoDraft({ ...baseParams, uuidFacturaOriginal: null }),
      { wrapper },
    );
    act(() => {
      result.current.setDescripcion("Descuento");
      result.current.setConceptos([sugerido("Servicio", 500)]);
    });
    expect(result.current.puedeGuardar).toBe(true);
    expect(result.current.puedeTimbrar).toBe(false);

    await act(async () => { await result.current.handleSubmit(true); });

    expect(mocks.crearNotaCredito).not.toHaveBeenCalled();
    expect(mocks.timbrarMutate).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("guardar borrador válido crea, avisa y cierra sin timbrar", async () => {
    const { result } = renderHook(() => useNotaCreditoDraft(baseParams), { wrapper });
    act(() => {
      result.current.setDescripcion("Descuento");
      result.current.setConceptos([sugerido("Servicio", 500)]);
    });

    await act(async () => { await result.current.handleSubmit(false); });
    await waitFor(() => expect(mocks.crearNotaCredito).toHaveBeenCalledTimes(1));

    expect(mocks.timbrarMutate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("guardar y timbrar con UUID válido timbra la NC creada", async () => {
    const { result } = renderHook(() => useNotaCreditoDraft(baseParams), { wrapper });
    act(() => {
      result.current.setDescripcion("Descuento");
      result.current.setConceptos([sugerido("Servicio", 500)]);
    });

    await act(async () => { await result.current.handleSubmit(true); });
    await waitFor(() => expect(mocks.timbrarMutate).toHaveBeenCalledWith("nc-1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("un error al crear no cierra el modal", async () => {
    // Los dos avisos de diagnóstico son el comportamiento esperado aquí: se
    // silencian sólo dentro de esta prueba y la consola se restaura siempre.
    const log = silenciarLogEsperado();
    try {
    mocks.crearNotaCredito.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useNotaCreditoDraft(baseParams), { wrapper });
    act(() => {
      result.current.setDescripcion("Descuento");
      result.current.setConceptos([sugerido("Servicio", 500)]);
    });

    await act(async () => { await result.current.handleSubmit(false); });
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
    } finally {
      log.restaurar();
    }
  });
});
