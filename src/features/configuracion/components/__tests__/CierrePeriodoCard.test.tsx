import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CierrePeriodoCard from "../CierrePeriodoCard";

const actualizarCierrePeriodo = vi.fn();
let valorGuardado = "";

vi.mock("@/features/configuracion/hooks/useConfiguracion", () => ({
  useConfigValue: () => valorGuardado,
}));

vi.mock("@/hooks/shared/useOrgActiva", () => ({
  useOrgActiva: () => ({ organizationId: "org-1" }),
}));

vi.mock("@/features/configuracion/services/configuracionClaves", () => ({
  actualizarCierrePeriodo: (...args: unknown[]) => actualizarCierrePeriodo(...args),
}));

const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: (...args: unknown[]) => notifyError(...args),
}));

function renderCard() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CierrePeriodoCard />
    </QueryClientProvider>,
  );
}

describe("CierrePeriodoCard", () => {
  beforeEach(() => {
    actualizarCierrePeriodo.mockReset();
    actualizarCierrePeriodo.mockResolvedValue(undefined);
    notifyError.mockClear();
    valorGuardado = "";
  });

  it("sin cierre configurado no muestra aviso ni botón de reapertura", () => {
    renderCard();
    expect(screen.getByText("Cierre de periodo contable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reabrir periodo/i })).toBeNull();
  });

  it("avance de fecha (sin retroceso) no exige motivo y llama al servicio", async () => {
    valorGuardado = "2026-01-31";
    renderCard();

    const grupo = screen.getByRole("group", { name: "Cerrado hasta" });
    const input = grupo.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31/3/2026" } });

    expect(screen.queryByLabelText(/Motivo del retroceso/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Guardar cierre/i }));

    await waitFor(() =>
      expect(actualizarCierrePeriodo).toHaveBeenCalledWith("org-1", "2026-03-31", undefined),
    );
  });

  it("retroceso (reabrir) exige motivo antes de guardar", async () => {
    valorGuardado = "2026-01-31";
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /Reabrir periodo/i }));
    expect(screen.getByLabelText(/Motivo del retroceso/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar cierre/i }));
    expect(await screen.findByText(/al menos 10 caracteres/i)).toBeInTheDocument();
    expect(actualizarCierrePeriodo).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Motivo del retroceso/i), {
      target: { value: "Se corrige una factura mal capturada" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cierre/i }));

    await waitFor(() =>
      expect(actualizarCierrePeriodo).toHaveBeenCalledWith(
        "org-1",
        null,
        "Se corrige una factura mal capturada",
      ),
    );
  });

  it("error del servidor muestra el mensaje traducido en español", async () => {
    valorGuardado = "2026-01-31";
    actualizarCierrePeriodo.mockRejectedValue(
      new Error("LC_CIERRE_MOTIVO_REQUERIDO: para reabrir o retroceder..."),
    );
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /Reabrir periodo/i }));
    fireEvent.change(screen.getByLabelText(/Motivo del retroceso/i), {
      target: { value: "Motivo suficientemente largo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cierre/i }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    const [, opts] = notifyError.mock.calls[0];
    expect(opts.description).toMatch(/mínimo 10 caracteres/i);
  });
});
