/**
 * v13.823.164 (smoke 162, P1) — El guardado rápido de costos ("Editar costos"
 * → "Guardar Costos") llamaba a la mutación SIN el sello de concurrencia, así
 * que el servicio fallaba cerrado y siempre decía "Otro usuario modificó este
 * registro". Estas regresiones cubren: sello del snapshot abierto, segundo
 * guardado con el sello devuelto y conflicto real (un solo aviso, captura
 * conservada).
 *
 * NO ejecutado en Lovable; corre en GitHub Actions con el resto de la suite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mutateAsync = vi.hoisted(() => vi.fn());
const notifyError = vi.hoisted(() => vi.fn());
const notifySuccess = vi.hoisted(() => vi.fn());

vi.mock("@/features/cotizacion/hooks", () => ({
  useCotizacionCostos: () => ({
    data: [
      {
        id: "c1",
        cotizacion_id: "cot-1",
        concepto: "Flete",
        moneda: "MXN",
        proveedor: "ACME",
        cantidad: 1,
        costo_unitario: 500,
        costo_total: 500,
        precio_venta: 0,
        notas: "nota previa",
      },
    ],
    isLoading: false,
  }),
  useUpsertCotizacionCostos: () => ({ mutateAsync, isPending: false }),
  useUpdateCotizacion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifySuccess }));

import SeccionCostosInternosPLDetalle from "../SeccionCostosInternosPLDetalle";

const SELLO_ABIERTO = "2026-09-06T10:00:00Z";

function renderSeccion() {
  return render(
    <SeccionCostosInternosPLDetalle
      cotizacionId="cot-1"
      conceptosUSD={[]}
      conceptosMXN={[]}
      cotizacionUpdatedAt={SELLO_ABIERTO}
    />,
  );
}

async function abrirEdicionYGuardar() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /editar costos/i }));
  await user.click(screen.getByRole("button", { name: /guardar costos/i }));
  return user;
}

beforeEach(() => {
  mutateAsync.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
});

describe("guardado rápido de costos con sello optimista", () => {
  it("envía el sello de la cotización abierta", async () => {
    mutateAsync.mockResolvedValue({ costos: [], updatedAt: "2026-09-06T11:00:00Z" });
    renderSeccion();
    await abrirEdicionYGuardar();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      cotizacionId: "cot-1",
      expectedUpdatedAt: SELLO_ABIERTO,
    });
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("un segundo guardado usa el sello nuevo devuelto por la RPC", async () => {
    mutateAsync
      .mockResolvedValueOnce({ costos: [], updatedAt: "2026-09-06T11:00:00Z" })
      .mockResolvedValueOnce({ costos: [], updatedAt: "2026-09-06T12:00:00Z" });
    renderSeccion();
    const user = await abrirEdicionYGuardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /editar costos/i }));
    await user.click(screen.getByRole("button", { name: /guardar costos/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0].expectedUpdatedAt).toBe("2026-09-06T11:00:00Z");
  });

  it("un conflicto real deja un solo aviso y conserva la captura", async () => {
    mutateAsync.mockRejectedValue(new Error("LC_CONFLICTO_CONCURRENCIA"));
    renderSeccion();
    await abrirEdicionYGuardar();

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
    expect(notifySuccess).not.toHaveBeenCalled();
    // Sigue en modo edición: no se pierde lo capturado.
    expect(screen.getByRole("button", { name: /guardar costos/i })).toBeInTheDocument();
  });
});
