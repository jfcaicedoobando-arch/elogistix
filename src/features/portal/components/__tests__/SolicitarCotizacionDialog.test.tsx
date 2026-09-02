import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SolicitarCotizacionDialog } from "../SolicitarCotizacionDialog";
import type { ClienteSolicitante } from "@/features/portal/domain/clientesSolicitantes";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  navigate: vi.fn(),
  idsRecibidos: [] as string[][],
}));

vi.mock("@/features/portal/hooks/useSolicitarCotizacion", () => ({
  useSolicitarCotizacion: (clienteIds: string[]) => {
    mocks.idsRecibidos.push(clienteIds);
    return { mutateAsync: mocks.mutateAsync, isPending: false };
  },
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: mocks.notifySuccess,
  notifyError: mocks.notifyError,
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

const UNO: ClienteSolicitante[] = [{ id: "cli-1", nombre: "Aceros del Norte" }];
const DOS: ClienteSolicitante[] = [
  { id: "cli-1", nombre: "Aceros del Norte" },
  { id: "cli-2", nombre: "Refacciones Bajío" },
];

function renderDialog(props: Partial<React.ComponentProps<typeof SolicitarCotizacionDialog>> = {}) {
  return render(
    <MemoryRouter>
      <SolicitarCotizacionDialog
        open={props.open ?? true}
        onOpenChange={props.onOpenChange ?? vi.fn()}
        clientes={props.clientes ?? UNO}
      />
    </MemoryRouter>,
  );
}

function capturarRuta() {
  fireEvent.change(screen.getByLabelText(/^Origen/i), { target: { value: "Shanghái" } });
  fireEvent.change(screen.getByLabelText(/^Destino/i), { target: { value: "Manzanillo" } });
}

describe("SolicitarCotizacionDialog (P-07)", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.notifySuccess.mockReset();
    mocks.notifyError.mockReset();
    mocks.navigate.mockReset();
    mocks.idsRecibidos.length = 0;
  });

  it("muestra errores de validación al intentar enviar sin origen y destino", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));

    expect(screen.getByText(/Captura el origen para continuar/i)).toBeInTheDocument();
    expect(screen.getByText(/Captura el destino para continuar/i)).toBeInTheDocument();
    const hintArea = screen.getByText(/Falta:/i).parentElement!;
    expect(hintArea.textContent).toContain("Origen");
    expect(hintArea.textContent).toContain("Destino");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("envía la solicitud, avisa con el folio y cierra el diálogo", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "cot-1", folio: "COT-2026-0007" });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    capturarRuta();
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ clienteId: "cli-1" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.notifySuccess).toHaveBeenCalled();
  });

  it("limpia el formulario al cerrar y reabrir", () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderDialog({ onOpenChange });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const vista = (open: boolean) => (
      <MemoryRouter>
        <SolicitarCotizacionDialog open={open} onOpenChange={onOpenChange} clientes={UNO} />
      </MemoryRouter>
    );
    rerender(vista(false));
    rerender(vista(true));
    expect((screen.getByLabelText(/^Origen/i) as HTMLInputElement).value).toBe("");
  });
});

describe("SolicitarCotizacionDialog — empresa solicitante (multicliente)", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.idsRecibidos.length = 0;
  });

  it("con una sola empresa la preselecciona y no muestra selector", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "c", folio: "COT-1" });
    renderDialog({ clientes: UNO });

    expect(screen.queryByLabelText(/Empresa solicitante/i)).not.toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Enviar solicitud/i });
    expect(btn).not.toBeDisabled();

    capturarRuta();
    fireEvent.click(btn);
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ clienteId: "cli-1" });
  });

  // Defecto 3 (v13.823.43): el botón ya NO se deshabilita por validación; al
  // enviar sin empresa elegida no se manda nada y se explica qué falta.
  it("con dos empresas no preselecciona: enviar sin elegir no manda la solicitud", () => {
    renderDialog({ clientes: DOS });
    expect(screen.getByLabelText(/Empresa solicitante/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Selecciona la empresa/i)).toBeInTheDocument();
  });

  it("las opciones muestran el nombre de la empresa, no el UUID", () => {
    renderDialog({ clientes: DOS });
    fireEvent.click(screen.getByLabelText(/Empresa solicitante/i));
    expect(screen.getByRole("option", { name: "Aceros del Norte" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Refacciones Bajío" })).toBeInTheDocument();
    expect(screen.queryByText("cli-2")).not.toBeInTheDocument();
  });

  it("al elegir la segunda empresa la solicitud se atribuye exactamente a esa", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "c", folio: "COT-2" });
    renderDialog({ clientes: DOS });

    fireEvent.click(screen.getByLabelText(/Empresa solicitante/i));
    fireEvent.click(screen.getByRole("option", { name: "Refacciones Bajío" }));

    capturarRuta();
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ clienteId: "cli-2" });
  });

  it("cerrar y reabrir con varias empresas exige elegir de nuevo", () => {
    const onOpenChange = vi.fn();
    const vista = (open: boolean) => (
      <MemoryRouter>
        <SolicitarCotizacionDialog open={open} onOpenChange={onOpenChange} clientes={DOS} />
      </MemoryRouter>
    );
    const { rerender } = render(vista(true));

    fireEvent.click(screen.getByLabelText(/Empresa solicitante/i));
    fireEvent.click(screen.getByRole("option", { name: "Refacciones Bajío" }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    rerender(vista(false));
    rerender(vista(true));

    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Selecciona la empresa/i)).toBeInTheDocument();
  });

  it("sin empresas vinculadas no envía y explica por qué", () => {
    renderDialog({ clientes: [] });
    expect(screen.getByText(/no está vinculada a una empresa/i)).toBeInTheDocument();
    capturarRuta();
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/i }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("la mutación recibe todos los ids autorizados (validación intacta)", () => {
    renderDialog({ clientes: DOS });
    expect(mocks.idsRecibidos[0]).toEqual(["cli-1", "cli-2"]);
  });
});
