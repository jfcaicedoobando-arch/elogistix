import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mutateAsync = vi.fn().mockResolvedValue({ version_anterior: 1, version_nueva: 2 });
vi.mock("@/features/cotizacion/hooks/useVersionadoCotizacion", () => ({
  useRecotizarCotizacion: () => ({ mutateAsync, isPending: false }),
}));

import { RecotizarModal } from "@/features/cotizacion/components/versionado/RecotizarModal";

function renderModal() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <RecotizarModal open onOpenChange={() => {}} cotizacionId="c1" versionActual={1} />
    </QueryClientProvider>,
  );
}

beforeEach(() => mutateAsync.mockClear());

describe("RecotizarModal", () => {
  it("deshabilita el botón sin motivo ni confirmación", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /confirmar re-cotización/i });
    expect(btn).toBeDisabled();
  });

  it("habilita cuando hay motivo y se tipea RECOTIZAR", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/motivo/i), {
      target: { value: "Cliente pidió cambio" },
    });
    fireEvent.change(screen.getByLabelText(/escribe/i), { target: { value: "RECOTIZAR" } });
    const btn = screen.getByRole("button", { name: /confirmar/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({
      cotizacionId: "c1",
      motivo: "Cliente pidió cambio",
    });
  });

  it("rechaza confirmación incorrecta", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "motivo válido" } });
    fireEvent.change(screen.getByLabelText(/escribe/i), { target: { value: "recotizar" } });
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });
});
