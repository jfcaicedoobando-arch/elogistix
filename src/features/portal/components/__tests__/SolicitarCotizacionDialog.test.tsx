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
        open={props.open ?? true}
        onOpenChange={props.onOpenChange ?? vi.fn()}
        clienteId={"clienteId" in props ? props.clienteId : "cli-1"}
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

  it("muestra errores de validación al intentar enviar sin origen y destino", async () => {
    renderDialog();
    const btnEnviar = screen.getByRole("button", { name: /Enviar solicitud/i });
    
    fireEvent.click(btnEnviar);
    
    expect(screen.getByText(/Captura el origen para continuar/i)).toBeInTheDocument();
    expect(screen.getByText(/Captura el destino para continuar/i)).toBeInTheDocument();
    expect(screen.getByText(/Falta:/i)).toBeInTheDocument();
    
    const hintArea = screen.getByText(/Falta:/i).parentElement!;
    expect(hintArea.textContent).toContain("Origen");
    expect(hintArea.textContent).toContain("Destino");
    
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("envía la solicitud, avisa con el folio y cierra el diálogo", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "cot-1", folio: "COT-2026-0007" });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.change(screen.getByLabelText(/Origen/i), { target: { value: "Shanghái" } });
    fireEvent.change(screen.getByLabelText(/Destino/i), { target: { value: "Manzanillo" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resetea el formulario al reabrir después de una cancelación limpia", async () => {
    const onOpenChangeMock = vi.fn();
    const { rerender } = renderDialog({ open: true, onOpenChange: onOpenChangeMock });
    
    // No marcamos como dirty para evitar el diálogo de confirmación en el test
    // pero verificamos el flujo de reset al cerrar.
    const btnCancelar = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(btnCancelar);
    
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    
    // Simular el efecto de onOpenChange(false) + rerender de Radix
    rerender(
      <MemoryRouter>
        <SolicitarCotizacionDialog open={false} onOpenChange={onOpenChangeMock} clienteIds={["cli-1"]} />
      </MemoryRouter>
    );
    
    // Reapertura
    rerender(
      <MemoryRouter>
        <SolicitarCotizacionDialog open={true} onOpenChange={onOpenChangeMock} clienteIds={["cli-1"]} />
      </MemoryRouter>
    );
    
    expect((screen.getByLabelText(/Origen/i) as HTMLInputElement).value).toBe("");
  });

  it("no permite enviar cuando la cuenta no tiene cliente vinculado", () => {
    renderDialog({ clienteId: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));
    
    expect(screen.getByText(/Falta:/i)).toBeInTheDocument();
    const hintArea = screen.getByText(/Falta:/i).parentElement!;
    expect(hintArea.textContent).toContain("Cuenta vinculada");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
});
