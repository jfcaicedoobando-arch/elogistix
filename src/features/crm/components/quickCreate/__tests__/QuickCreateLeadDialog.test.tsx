/**
 * Validación mínima del alta rápida de lead: el campo "Empresa" es obligatorio
 * y el botón "Crear" debe bloquearse (con mensaje accesible) mientras esté vacío.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickCreateLeadDialog from "@/features/crm/components/quickCreate/QuickCreateLeadDialog";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({ id: "lead-1" }));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@librecarga.com" } }),
}));
vi.mock("@/features/crm/hooks", () => ({
  useCrearLead: () => ({ mutateAsync, isPending: false }),
}));
const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));

describe("QuickCreateLeadDialog", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
  });

  it("deshabilita 'Crear' y muestra error inline mientras Empresa está vacía", async () => {
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    const empresaInput = screen.getByLabelText(/Empresa/i);
    const crearBtn = screen.getByRole("button", { name: /Crear/i });

    expect(empresaInput).toHaveValue("");
    expect(crearBtn).toBeDisabled();

    fireEvent.blur(empresaInput);
    await waitFor(() => {
      expect(screen.getByText("Indica la empresa para continuar.")).toBeInTheDocument();
    });
    expect(empresaInput).toHaveAttribute("aria-invalid", "true");

    fireEvent.click(crearBtn);
    await waitFor(() => expect(mutateAsync).not.toHaveBeenCalled());
  });

  it("permite crear cuando Empresa tiene valor", async () => {
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    const empresaInput = screen.getByLabelText(/Empresa/i);
    const crearBtn = screen.getByRole("button", { name: /Crear/i });

    fireEvent.change(empresaInput, { target: { value: "  Acme Logistics  " } });
    expect(crearBtn).toBeEnabled();

    fireEvent.click(crearBtn);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]![0];
    expect(payload.empresa).toBe("Acme Logistics");
  });

  it("guarda con origen Prospección por defecto y el select muestra las 3 opciones", async () => {
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    // El control visible de Origen (SelectTrigger etiquetado) muestra el default.
    // `getByText("Prospección")` era ambiguo: Radix también renderiza un <select>
    // nativo oculto con las 3 opciones para la integración con el <form>.
    const origen = screen.getByLabelText("Origen");
    expect(origen).toHaveTextContent("Prospección");

    // Las 3 opciones del catálogo viajan en el select nativo oculto de Radix,
    // sin abrir el popover (portal) para no depender de eventos de puntero.
    const nativo = document.querySelector("select");
    const opciones = Array.from(nativo?.querySelectorAll("option") ?? [])
      .map((o) => o.value)
      .filter((v) => v !== "");
    expect(opciones).toEqual(["Prospección", "Finkargo", "Referido"]);

    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]![0].fuente).toBe("Prospección");
  });

  it("'Más campos →' conserva el origen elegido en el borrador", () => {
    const onMore = vi.fn();
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={onMore} />);

    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /Más campos/i }));

    expect(onMore).toHaveBeenCalledWith({
      empresa: "Acme",
      contacto: "",
      fuente: "Prospección",
    });
  });

  it("lead rápido: si la creación falla no repite el aviso de error (el hook ya notifica)", async () => {
    notifyError.mockClear();
    mutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    // El único feedback de error visible lo emite useCrearLead.onError.
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("limpia el estado de validación al cerrarse y no muestra error al reabrir", async () => {
    const { rerender } = render(
      <QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />,
    );

    const empresaInput = screen.getByLabelText(/Empresa/i);
    fireEvent.blur(empresaInput);
    await waitFor(() => {
      expect(screen.getByText("Indica la empresa para continuar.")).toBeInTheDocument();
    });

    // Cierra y reabre el modal.
    rerender(<QuickCreateLeadDialog open={false} onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);
    rerender(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    // Inmediatamente después de reabrir no debe aparecer el mensaje de error.
    expect(screen.queryByText("Indica la empresa para continuar.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Empresa/i)).toHaveAttribute("aria-invalid", "false");

    // El error vuelve a aparecer sólo tras nueva interacción (blur/submit).
    fireEvent.blur(screen.getByLabelText(/Empresa/i));
    await waitFor(() => {
      expect(screen.getByText("Indica la empresa para continuar.")).toBeInTheDocument();
    });
  });
});
