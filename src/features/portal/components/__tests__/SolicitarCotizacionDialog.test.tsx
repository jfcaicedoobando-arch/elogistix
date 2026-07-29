import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SolicitarCotizacionDialog } from "../SolicitarCotizacionDialog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/features/portal/hooks/useSolicitarCotizacion", () => ({
  useSolicitarCotizacion: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: mocks.notifySuccess,
  notifyError: mocks.notifyError,
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

function renderDialog(props: Partial<React.ComponentProps<typeof SolicitarCotizacionDialog>> = {}) {
  return render(
    <MemoryRouter>
      <SolicitarCotizacionDialog
        open
        onOpenChange={props.onOpenChange ?? vi.fn()}
        clienteId={props.clienteId === undefined ? "cli-1" : props.clienteId}
        clienteIds={["cli-1"]}
      />
    </MemoryRouter>,
  );
}

describe("SolicitarCotizacionDialog (P-07)", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.notifySuccess.mockReset();
    mocks.notifyError.mockReset();
    mocks.navigate.mockReset();
  });

  it("mantiene deshabilitado el envío sin origen y destino", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /Enviar solicitud/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Origen/i), { target: { value: "Shanghái" } });
    expect(screen.getByRole("button", { name: /Enviar solicitud/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Destino/i), { target: { value: "Manzanillo" } });
    expect(screen.getByRole("button", { name: /Enviar solicitud/i })).toBeEnabled();
  });

  it("envía la solicitud, avisa con el folio y cierra el diálogo", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "cot-1", folio: "COT-2026-0007" });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.change(screen.getByLabelText(/Origen/i), { target: { value: "Shanghái" } });
    fireEvent.change(screen.getByLabelText(/Destino/i), { target: { value: "Manzanillo" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: "cli-1",
        origen: "Shanghái",
        destino: "Manzanillo",
        modo: "Marítimo",
        tipoEmbarque: "FCL",
      }),
    );
    await waitFor(() =>
      expect(mocks.notifySuccess).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ description: expect.stringContaining("COT-2026-0007") }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.navigate).toHaveBeenCalledWith("/portal/cotizaciones");
  });

  it("notifica el error y no cierra el diálogo si la solicitud falla", async () => {
    mocks.mutateAsync.mockImplementation(() => Promise.reject(new Error("LC_CLIENTE_NO_VINCULADO")));
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.change(screen.getByLabelText(/Origen/i), { target: { value: "Shanghái" } });
    fireEvent.change(screen.getByLabelText(/Destino/i), { target: { value: "Manzanillo" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("no permite enviar cuando la cuenta no tiene cliente vinculado", () => {
    renderDialog({ clienteId: undefined });
    expect(screen.getByRole("button", { name: /Enviar solicitud/i })).toBeDisabled();
  });
});
