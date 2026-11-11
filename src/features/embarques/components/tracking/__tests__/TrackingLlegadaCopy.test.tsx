import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { todayLocalISO } from "@/lib/date/today";
import { createWrapper } from "@/test/utils/queryWrapper";

const fx = vi.hoisted(() => ({
  rpc: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: fx.rpc } }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: fx.error, notifySuccess: fx.success }));

import { TrackingNuevoEventoForm } from "../TrackingNuevoEventoForm";

beforeEach(() => {
  vi.clearAllMocks();
  fx.rpc.mockImplementation(async (_name, args) => ({ data: args.p_request_id, error: null }));
});

function abrir() {
  const onClose = vi.fn();
  render(<TooltipProvider><TrackingNuevoEventoForm embarqueId="emb-ficticio" estadoActual="En Tránsito" modoTransporte="Terrestre" destinoDefault="Destino ficticio" onClose={onClose} /></TooltipProvider>, { wrapper: createWrapper() });
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
    expect(fx.rpc).not.toHaveBeenCalled();
    const guardar = screen.getByRole("button", { name: "Registrar llegada real" });
    await waitFor(() => expect(guardar).toBeEnabled());
    fireEvent.click(guardar);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(fx.rpc).toHaveBeenCalledExactlyOnceWith("registrar_evento_tracking_embarque", expect.objectContaining({
      p_embarque_id: "emb-ficticio", p_accion: "llegada", p_fecha: todayLocalISO(), p_ubicacion: "Destino ficticio",
    }));
  });

  it("documentos pendientes siguen bloqueando el registro y su evento", async () => {
    fx.rpc.mockResolvedValueOnce({ error: { message: "LC_TRACKING_DOCS_PENDIENTES: Hay 2 documentos pendientes.", code: "23514" } });
    const onClose = abrir();
    const guardar = screen.getByRole("button", { name: "Registrar llegada real" });
    await waitFor(() => expect(guardar).toBeEnabled());
    fireEvent.click(guardar);
    await waitFor(() => expect(fx.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Documentos incompletos" })));
    expect(fx.rpc).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});
