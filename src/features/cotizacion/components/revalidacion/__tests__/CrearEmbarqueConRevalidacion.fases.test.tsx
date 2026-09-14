import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

// useFiltrosTarifaCotizacion usa TanStack Query: cada render se envuelve en
// un QueryClient aislado (sin reintentos) para no acoplar la prueba al
// QueryClient global de la app.
function renderConQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const revalidarTarifa = vi.fn();
const mutateAsync = vi.fn();
const notifyError = vi.fn();
const verificarCostosOAvisar = vi.fn();

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
  notifyWarning: vi.fn(),
}));

// El candado de costos tiene su propia suite; aquí sólo interesa separar
// revalidación de creación, así que se deja pasar.
vi.mock("@/features/cotizacion/services/candadoCostosAviso", () => ({
  verificarCostosOAvisar: (...a: unknown[]) => verificarCostosOAvisar(...a),
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
    verificarCostosOAvisar.mockReset();
    verificarCostosOAvisar.mockResolvedValue(true);
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

  it("si el candado de costos no aprueba (fail-closed), no revalida ni crea", async () => {
    verificarCostosOAvisar.mockResolvedValue(false);
    revalidarTarifa.mockResolvedValue(SIN_CAMBIOS);

    render(<CrearEmbarqueConRevalidacion cotizacionId="cot-1" numContenedores={1} />);
    fireEvent.click(screen.getByRole("button", { name: /crear embarque/i }));

    await waitFor(() => expect(verificarCostosOAvisar).toHaveBeenCalledWith("cot-1"));
    expect(revalidarTarifa).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
    // El aviso lo emite el propio candado: aquí no debe haber toast de error.
    expect(notifyError).not.toHaveBeenCalled();
  });
});
