import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { todayLocalISO } from "@/lib/date/today";

const fx = vi.hoisted(() => ({
  llegada: vi.fn(), evento: vi.fn(), eta: vi.fn(), pendientes: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/features/embarques/hooks", () => ({ useCreateEventoEmbarque: () => ({ mutateAsync: fx.evento, isPending: false }) }));
vi.mock("@/features/embarques/hooks/mutations/useActualizarFechaLlegadaReal", () => ({
  useActualizarFechaLlegadaReal: () => ({ mutateAsync: fx.llegada, isPending: false }),
}));
vi.mock("@/features/embarques/hooks/mutations/useActualizarEta", () => ({
  useActualizarEta: () => ({ mutateAsync: fx.eta, isPending: false }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "operador@example.test" } }) }));
vi.mock("@/features/embarques/services/documentosPendientes", () => ({ contarDocumentosPendientes: fx.pendientes }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: fx.error, notifySuccess: fx.success }));

import { TrackingNuevoEventoForm } from "../TrackingNuevoEventoForm";

beforeEach(() => {
  vi.clearAllMocks();
  fx.llegada.mockResolvedValue(undefined);
  fx.evento.mockResolvedValue(undefined);
  fx.pendientes.mockResolvedValue(0);
});

function abrir() {
  const onClose = vi.fn();
  render(<TooltipProvider><TrackingNuevoEventoForm embarqueId="emb-ficticio" estadoActual="En Tránsito" modoTransporte="Terrestre" destinoDefault="Destino ficticio" onClose={onClose} /></TooltipProvider>);
  expect(screen.getByRole("button", { name: /Registrar llegada real/ })).toHaveTextContent("Desde En Tránsito o En Proceso pasa a Arribo");
  fireEvent.click(screen.getByRole("button", { name: /Registrar llegada real/ }));
  return onClose;
}

describe("explicación de llegada real y efectos existentes", () => {
  it("anticipa requisitos y conserva el payload de fecha real y el evento", async () => {
    const onClose = abrir();
    expect(screen.getByText(/Completa los documentos pendientes/)).toHaveTextContent("igual o posterior a la salida estimada (ETD)");
    expect(screen.getByText(/Una llegada real ya registrada/)).toHaveTextContent("no puede sustituirse desde este formulario");
    expect(screen.getByText(/Si el embarque está En Tránsito/)).toHaveTextContent("En etapas posteriores compatibles conservará su estado");
    expect(screen.getByLabelText("Fecha de llegada real *")).toBeEnabled();
    expect(fx.llegada).not.toHaveBeenCalled();
    const guardar = screen.getByRole("button", { name: "Registrar llegada real" });
    await waitFor(() => expect(guardar).toBeEnabled());
    fireEvent.click(guardar);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(fx.pendientes).toHaveBeenCalledExactlyOnceWith("emb-ficticio");
    expect(fx.llegada).toHaveBeenCalledExactlyOnceWith({ embarqueId: "emb-ficticio", fechaIso: todayLocalISO() });
    expect(fx.evento).toHaveBeenCalledWith(expect.objectContaining({ embarqueId: "emb-ficticio", tipo: "Arribo a Puerto", ubicacion: "Destino ficticio" }));
    expect(fx.eta).not.toHaveBeenCalled();
  });

  it("documentos pendientes siguen bloqueando el registro y su evento", async () => {
    fx.pendientes.mockResolvedValue(2);
    const onClose = abrir();
    const guardar = screen.getByRole("button", { name: "Registrar llegada real" });
    await waitFor(() => expect(guardar).toBeEnabled());
    fireEvent.click(guardar);
    await waitFor(() => expect(fx.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Documentos incompletos" })));
    expect(fx.llegada).not.toHaveBeenCalled();
    expect(fx.evento).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
