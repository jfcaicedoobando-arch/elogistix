/**
 * v13.823.164–166 (smoke 162, P1) — Guardado rápido de costos ("Editar costos"
 * → "Guardar Costos"):
 *   - 164: se enviaba SIN sello de concurrencia y siempre fallaba cerrado.
 *   - 165: el segundo guardado recuperaba el sello viejo (la prop) y el
 *     reemplazo borraba `unidad_medida` / `costeo_tarifa_*` de cada fila.
 *
 * La lectura expone una fotografía ESTABLE (filas + sello) para que la prueba
 * cambie ambos datos juntos, igual que la consulta productiva.
 *
 * NO ejecutado en Lovable; corre en GitHub Actions con el resto de la suite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const mutateAsync = vi.hoisted(() => vi.fn());
const notifyError = vi.hoisted(() => vi.fn());
const notifySuccess = vi.hoisted(() => vi.fn());

const costo = (importe: number, notas: string) => ({
  id: "c1", cotizacion_id: "cot-1", concepto: "Flete", moneda: "MXN" as const,
  proveedor: "ACME", cantidad: 1, costo_unitario: importe, costo_total: importe,
  precio_venta: 700, unidad_medida: "contenedor", notas,
  costeo_tarifa_id: "tar-1", costeo_tarifa_recargo_id: "rec-1",
  created_at: "", updated_at: "",
});

const COSTOS_500 = vi.hoisted(() => [
  {
    id: "c1", cotizacion_id: "cot-1", concepto: "Flete", moneda: "MXN",
    proveedor: "ACME", cantidad: 1, costo_unitario: 500, costo_total: 500,
    precio_venta: 700, unidad_medida: "contenedor", notas: "nota previa",
    costeo_tarifa_id: "tar-1", costeo_tarifa_recargo_id: "rec-1",
    created_at: "", updated_at: "",
  },
]);

const COSTOS_600 = [costo(600, "guardado 1")];
const COSTOS_700 = [costo(700, "guardado 2")];
const COSTOS_800 = [costo(800, "guardado 3")];
let snapshot = { costos: COSTOS_500, updatedAt: "2026-09-06T10:00:00Z" };

vi.mock("@/features/cotizacion/hooks", () => ({
  useCotizacionCostosSnapshot: () => ({ data: snapshot, isLoading: false }),
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

function renderSeccion() {
  return render(
    <SeccionCostosInternosPLDetalle
      cotizacionId="cot-1"
      conceptosUSD={[]}
      conceptosMXN={[]}
      cotizacionUpdatedAt={S0}
    />,
  );
}

function vista() {
  return (
    <SeccionCostosInternosPLDetalle
      cotizacionId="cot-1"
      conceptosUSD={[]}
      conceptosMXN={[]}
      cotizacionUpdatedAt={S0}
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
  snapshot = { costos: COSTOS_500, updatedAt: S0 };
});

describe("guardado rápido de costos con sello optimista", () => {
  it("envía el sello de la cotización abierta", async () => {
    mutateAsync.mockResolvedValue({ costos: COSTOS_600, updatedAt: S1 });
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
    mutateAsync.mockResolvedValue({ costos: COSTOS_600, updatedAt: S1 });
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

  it("tres guardados mantienen filas y sello aunque la prop siga retrasada", async () => {
    mutateAsync
      .mockResolvedValueOnce({ costos: COSTOS_600, updatedAt: S1 })
      .mockResolvedValueOnce({ costos: COSTOS_700, updatedAt: S2 })
      .mockResolvedValueOnce({ costos: COSTOS_800, updatedAt: "2026-09-06T13:00:00Z" });
    const { rerender } = renderSeccion();
    abrirEdicionYGuardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // El detalle padre sigue en S0; no puede mezclarse con los costos del hook.
    rerender(vista());
    await waitFor(() => screen.getByRole("button", { name: /editar costos/i }));
    abrirEdicionYGuardar();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0].expectedUpdatedAt).toBe(S1);
    expect(mutateAsync.mock.calls[1][0].costos[0].costo_unitario).toBe(600);

    rerender(vista());
    abrirEdicionYGuardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(3));
    expect(mutateAsync.mock.calls[2][0].expectedUpdatedAt).toBe(S2);
    expect(mutateAsync.mock.calls[2][0].costos[0]).toMatchObject({
      costo_unitario: 700, notas: "guardado 2",
    });
  });

  it("adopta una fotografía externa completa sólo fuera de edición", async () => {
    const { rerender } = renderSeccion();
    abrirEdicion();
    snapshot = { costos: COSTOS_600, updatedAt: S1 };
    rerender(vista());
    expect(screen.getByLabelText(/costo unitario de flete/i)).toHaveValue(500);
    fireEvent.click(screen.getByRole("button", { name: /cancelar edición/i }));
    await waitFor(() => expect(screen.getByText(/600/)).toBeInTheDocument());
  });

  it("cancelar restaura el último guardado antes de que llegue el refetch", async () => {
    mutateAsync.mockResolvedValue({ costos: COSTOS_600, updatedAt: S1 });
    renderSeccion();
    abrirEdicionYGuardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    abrirEdicion();
    fireEvent.change(screen.getByPlaceholderText(/notas/i), { target: { value: "cancelar esto" } });
    fireEvent.click(screen.getByRole("button", { name: /cancelar edición/i }));
    abrirEdicion();
    expect(screen.getByPlaceholderText(/notas/i)).toHaveValue("guardado 1");
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
