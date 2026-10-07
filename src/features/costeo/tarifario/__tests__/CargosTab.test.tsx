import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { CargosTab } from "../CargosTab";
import { archivarCargo, listarCargos } from "../cargosService";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

vi.mock("../cargosService", () => ({ listarCargos: vi.fn(), archivarCargo: vi.fn() }));
vi.mock("../CargoFormDialog", () => ({ CargoFormDialog: () => <div>Formulario de cargo</div> }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
const cargo = { id: "c1", entidad_id: "a1", entidad: { nombre: "Agente uno" }, concepto: "FOB origen", monto: 120, moneda: "USD", unidad: "Por BL" };
function setup(puedeEditar = true) {
  vi.mocked(listarCargos).mockResolvedValue([cargo]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CargosTab tipo="fob" orgId="org" puedeEditar={puedeEditar} /></QueryClientProvider>);
}

describe("CargosTab canonical table", () => {
  it("conserva lectura y edición del cargo", async () => {
    setup();
    expect(await screen.findByText("Agente uno")).toBeInTheDocument();
    expect(screen.getByText("FOB origen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByText("Formulario de cargo")).toBeInTheDocument();
  });
  it("conserva el retiro recuperable y confirma éxito", async () => {
    vi.mocked(archivarCargo).mockResolvedValue();
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Retirar" }));
    await waitFor(() => expect(archivarCargo).toHaveBeenCalledWith("fob", "c1"));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, { title: "Cargo retirado" });
  });
  it("preserva el error original en diagnóstico", async () => {
    const error = new Error("denied");
    vi.mocked(archivarCargo).mockRejectedValue(error);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Retirar" }));
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({ error, method: "archivarCargo" })));
  });
  it("no muestra edición ni retiro para lectores", async () => {
    setup(false);
    await screen.findByText("Agente uno");
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar" })).not.toBeInTheDocument();
  });
});
