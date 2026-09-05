import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const revalidarTarifa = vi.fn();
const mutateAsync = vi.fn();
const notifyError = vi.fn();

vi.mock("@/features/cotizacion/services/revalidacion", () => ({
  revalidarTarifa: (...a: unknown[]) => revalidarTarifa(...a),
}));

vi.mock("@/features/cotizacion/hooks/useRevalidacionTarifa", () => ({
  useCrearEmbarqueBorradorConDecision: () => ({
    mutateAsync: (...a: unknown[]) => mutateAsync(...a),
    isPending: false,
  }),
  useSolicitarReaprobacion: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

vi.mock("@/features/costeo/components/BuscarTarifaDialog", () => ({
  BuscarTarifaDialog: () => null,
}));

import { CrearEmbarqueConRevalidacion } from "@/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion";

const SIN_CAMBIOS = {
  tarifa_vigente: true,
  agente_sin_cupo: false,
  severidad: "sin_cambios" as const,
  cambios: [],
  umbral_pct: 5,
  max_delta_pct: 0,
  tarifa_id_vigente: "tar-1",
};

describe("CrearEmbarqueConRevalidacion · fases separadas", () => {
  beforeEach(() => {
    revalidarTarifa.mockReset();
    mutateAsync.mockReset();
    notifyError.mockReset();
  });

  it("si la revalidación funciona y falla la creación, NO muestra el aviso de revalidación", async () => {
    revalidarTarifa.mockResolvedValue(SIN_CAMBIOS);
    mutateAsync.mockRejectedValue(new Error("no se pudo crear el embarque"));

    render(<CrearEmbarqueConRevalidacion cotizacionId="cot-1" numContenedores={1} />);
    fireEvent.click(screen.getByRole("button", { name: /crear embarque/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    // La mutation ya notifica su error: aquí no debe haber toast duplicado
    // ni el mensaje equivocado de "No se pudo revalidar la tarifa".
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("si falla la revalidación sí muestra su aviso y no intenta crear", async () => {
    revalidarTarifa.mockRejectedValue(new Error("timeout"));

    render(<CrearEmbarqueConRevalidacion cotizacionId="cot-1" numContenedores={1} />);
    fireEvent.click(screen.getByRole("button", { name: /crear embarque/i }));

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
    expect(notifyError.mock.calls[0][1].title).toMatch(/No se pudo revalidar la tarifa/i);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
