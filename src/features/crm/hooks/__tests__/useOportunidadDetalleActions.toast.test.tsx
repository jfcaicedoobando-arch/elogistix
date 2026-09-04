/**
 * Regresión — crear cotización desde oportunidad debe emitir un único toast.
 *
 * Antes v13.823.83, `useCrearCotizacionDesdeOportunidad` mostraba un toast de
 * éxito genérico en onSuccess y `useOportunidadDetalleActions` volvía a llamar
 * `crmToast.success` con el folio. El usuario recibía dos avisos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mockNavigate = vi.hoisted(() => vi.fn());
const crearCotizacionMutateAsync = vi.hoisted(() => vi.fn());
const eliminarMutateAsync = vi.hoisted(() => vi.fn());
const crmToastSuccess = vi.hoisted(() => vi.fn());
const notifyInfoFn = vi.hoisted(() => vi.fn());
const notifyErrorFn = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: {
    success: crmToastSuccess,
    error: vi.fn(),
    info: vi.fn(),
    undo: vi.fn(),
  },
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyInfo: notifyInfoFn,
  notifyError: notifyErrorFn,
}));

vi.mock("@/features/crm/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/crm/hooks")>();
  return {
    ...actual,
    useCrearCotizacionDesdeOportunidad: () => ({
      mutateAsync: crearCotizacionMutateAsync,
      isPending: false,
    }),
    useEliminarOportunidad: () => ({
      mutateAsync: eliminarMutateAsync,
      isPending: false,
    }),
  };
});

import { useOportunidadDetalleActions } from "../useOportunidadDetalleActions";

const op = {
  id: "op-1",
  cliente_id: null,
  cliente_nombre: null,
  origen: "Shanghai",
  destino: "Manzanillo",
  etapa_id: "etapa-1",
  modo: "Marítimo",
};

const etapasConCotizando = [
  { id: "etapa-1", nombre: "Nueva", tipo: "abierta", probabilidad_default: 10 },
  { id: "etapa-cotizando", nombre: "Cotizando", tipo: "abierta", probabilidad_default: 40 },
];

describe("useOportunidadDetalleActions — toast de cotización", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    crearCotizacionMutateAsync.mockReset();
    eliminarMutateAsync.mockReset();
    crmToastSuccess.mockReset();
    notifyInfoFn.mockReset();
    notifyErrorFn.mockReset();
  });

  it("emite un único toast de éxito y navega a la cotización", async () => {
    crearCotizacionMutateAsync.mockResolvedValue({
      id: "cot-1",
      folio: "COT-2026-0001",
      reutilizada: false,
    });

    const { result } = renderHook(
      () => useOportunidadDetalleActions(op, etapasConCotizando),
      { wrapper: createWrapper() },
    );

    await result.current.crearCotizacion();

    expect(crearCotizacionMutateAsync).toHaveBeenCalledOnce();
    expect(crmToastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Cotización creada · COT-2026-0001",
    );
    expect(notifyInfoFn).not.toHaveBeenCalled();
    expect(notifyErrorFn).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledExactlyOnceWith(
      "/cotizaciones/cot-1/editar",
    );
  });

  it("muestra un solo toast informativo si la etapa no pudo actualizarse", async () => {
    crearCotizacionMutateAsync.mockResolvedValue({
      id: "cot-2",
      folio: "COT-2026-0002",
      reutilizada: false,
      avisoEtapa: "timeout",
    });

    const { result } = renderHook(
      () => useOportunidadDetalleActions(op, etapasConCotizando),
      { wrapper: createWrapper() },
    );

    await result.current.crearCotizacion();

    expect(crearCotizacionMutateAsync).toHaveBeenCalledOnce();
    expect(crmToastSuccess).not.toHaveBeenCalled();
    expect(notifyInfoFn).toHaveBeenCalledOnce();
    expect(notifyInfoFn).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        title: "Cotización creada · COT-2026-0002",
        description: expect.stringContaining("timeout"),
      }),
    );
    expect(notifyErrorFn).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledExactlyOnceWith(
      "/cotizaciones/cot-2/editar",
    );
  });
});
