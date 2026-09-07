/**
 * v13.823.164/165 (smoke 162, P1) — Guardado rápido de costos ("Editar costos"
 * → "Guardar Costos"):
 *   - 164: se enviaba SIN sello de concurrencia y siempre fallaba cerrado.
 *   - 165: el segundo guardado recuperaba el sello viejo (la prop) y el
 *     reemplazo borraba `unidad_medida` / `costeo_tarifa_*` de cada fila.
 *
 * El fixture de la lectura es un array ESTABLE (hoisted): el componente deriva
 * filas en un `useEffect` que depende de él; un array nuevo por render provocaba
 * renders en bucle antes de llegar a la aserción.
 *
 * NO ejecutado en Lovable; corre en GitHub Actions con el resto de la suite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const mutateAsync = vi.hoisted(() => vi.fn());
const notifyError = vi.hoisted(() => vi.fn());
const notifySuccess = vi.hoisted(() => vi.fn());

const COSTOS = vi.hoisted(() => [
  {
    id: "c1",
    cotizacion_id: "cot-1",
    concepto: "Flete",
    moneda: "MXN",
    proveedor: "ACME",
    cantidad: 1,
    costo_unitario: 500,
    costo_total: 500,
    precio_venta: 700,
    unidad_medida: "contenedor",
    notas: "nota previa",
    costeo_tarifa_id: "tar-1",
    costeo_tarifa_recargo_id: "rec-1",
    created_at: "",
    updated_at: "",
  },
]);

vi.mock("@/features/cotizacion/hooks", () => ({
  useCotizacionCostos: () => ({ data: COSTOS, isLoading: false }),
  useUpsertCotizacionCostos: () => ({ mutateAsync, isPending: false }),
  useUpdateCotizacion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifySuccess }));

import SeccionCostosInternosPLDetalle from "../SeccionCostosInternosPLDetalle";

const S0 = "2026-09-06T10:00:00Z";
const S1 = "2026-09-06T11:00:00Z";
const S2 = "2026-09-06T12:00:00Z";

function renderSeccion(sello: string | null = S0) {
  return render(
    <SeccionCostosInternosPLDetalle
      cotizacionId="cot-1"
      conceptosUSD={[]}
      conceptosMXN={[]}
      cotizacionUpdatedAt={sello}
    />,
  );
}

function vista(sello: string | null) {
  return (
    <SeccionCostosInternosPLDetalle
      cotizacionId="cot-1"
      conceptosUSD={[]}
      conceptosMXN={[]}
      cotizacionUpdatedAt={sello}
    />
  );
}

const abrirEdicion = () =>
  fireEvent.click(screen.getByRole("button", { name: /editar costos/i }));
const guardar = () =>
  fireEvent.click(screen.getByRole("button", { name: /guardar costos/i }));

function abrirEdicionYGuardar() {
  abrirEdicion();
  guardar();
}

beforeEach(() => {
  mutateAsync.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
});

describe("guardado rápido de costos con sello optimista", () => {
  it("envía el sello de la cotización abierta", async () => {
    mutateAsync.mockResolvedValue({ costos: COSTOS, updatedAt: S1 });
    renderSeccion();
    abrirEdicionYGuardar();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      cotizacionId: "cot-1",
      expectedUpdatedAt: S0,
    });
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("preserva unidad_medida y el vínculo de tarifa al guardar sólo la nota", async () => {
    mutateAsync.mockResolvedValue({ costos: COSTOS, updatedAt: S1 });
    renderSeccion();
    abrirEdicion();
    fireEvent.change(screen.getByPlaceholderText(/notas/i), { target: { value: "nota nueva" } });
    guardar();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0].costos[0]).toMatchObject({
      concepto: "Flete",
      moneda: "MXN",
      notas: "nota nueva",
      unidad_medida: "contenedor",
      costeo_tarifa_id: "tar-1",
      costeo_tarifa_recargo_id: "rec-1",
      precio_venta: 700,
    });
  });

  it("un segundo guardado usa el sello nuevo aunque la prop siga retrasada", async () => {
    mutateAsync
      .mockResolvedValueOnce({ costos: COSTOS, updatedAt: S1 })
      .mockResolvedValueOnce({ costos: COSTOS, updatedAt: S2 });
    const { rerender } = renderSeccion();
    abrirEdicionYGuardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // Refetch tardío: la prop todavía trae el sello ya consumido (S0).
    rerender(vista(S0));
    await waitFor(() => screen.getByRole("button", { name: /editar costos/i }));
    abrirEdicion();
    guardar();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0].expectedUpdatedAt).toBe(S1);
  });

  it("adopta una lectura nueva de otro usuario cuando no se está editando", async () => {
    mutateAsync.mockResolvedValue({ costos: COSTOS, updatedAt: S1 });
    const { rerender } = renderSeccion();
    abrirEdicionYGuardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // Alguien más modificó la cotización: sello distinto del consumido → se adopta.
    rerender(vista(S2));
    await waitFor(() => screen.getByRole("button", { name: /editar costos/i }));
    abrirEdicion();
    guardar();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0].expectedUpdatedAt).toBe(S2);
  });

  it("un conflicto real deja un solo aviso y conserva la captura modificada", async () => {
    mutateAsync.mockRejectedValue(new Error("LC_CONFLICTO_CONCURRENCIA"));
    renderSeccion();
    abrirEdicion();
    fireEvent.change(screen.getByLabelText(/proveedor de flete/i), {
      target: { value: "PROVEEDOR EDITADO" },
    });
    guardar();

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
    expect(notifySuccess).not.toHaveBeenCalled();
    // La captura sigue en pantalla (no se rehidrató desde la BD).
    expect(screen.getByLabelText(/proveedor de flete/i)).toHaveValue("PROVEEDOR EDITADO");
  });
});
