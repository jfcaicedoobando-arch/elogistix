import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabCierre } from "../TabCierre";

const m = vi.hoisted(() => ({ error: false, logError: false, logLoading: false, fetching: false, retry: vi.fn(), retryLog: vi.fn(), cerrar: vi.fn() }));
vi.mock("../../hooks/useCierreEmbarque", () => ({
  useValidacionCierre: () => ({ data: { checks: [], puede_cerrar: true }, isLoading: false, isError: m.error, isFetching: m.fetching, refetch: m.retry }),
  useCierreLog: () => ({ data: [], isLoading: m.logLoading, isError: m.logError, refetch: m.retryLog }),
  useCerrarEmbarque: () => ({ isPending: false, mutate: m.cerrar }),
  useReabrirEmbarque: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("../../hooks/useSinComisionEmbarque", () => ({ useSinComisionEmbarque: () => ({ data: { efectivo: false } }) }));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canCerrarEmbarque: true, isAdmin: true }) }));
vi.mock("../cierre/CierreChecklistCard", () => ({ CierreChecklistCard: () => <div>Checklist disponible</div> }));
beforeEach(() => { vi.clearAllMocks(); m.error = false; m.logError = false; m.logLoading = false; m.fetching = false; });
const view = () => <MemoryRouter><TabCierre embarqueId="e1" estatus="Entregado" modo="Aéreo" /></MemoryRouter>;

describe("recuperación del cierre", () => {
  it("distingue fallo de validación, permite reintentar y bloquea datos anteriores", () => {
    m.error = true;
    const { rerender } = render(view());
    expect(screen.queryByText("Checklist disponible")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar embarque" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(m.retry).toHaveBeenCalledOnce();
    expect(m.cerrar).not.toHaveBeenCalled();
    m.error = false;
    rerender(view());
    expect(screen.getByText("Checklist disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar embarque" })).toBeEnabled();
  });

  it("no presenta un historial fallido o en carga como Sin movimientos", () => {
    m.logError = true;
    const { rerender } = render(view());
    expect(screen.queryByText("Sin movimientos.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(m.retryLog).toHaveBeenCalledOnce();
    m.logError = false; m.logLoading = true;
    rerender(view());
    expect(screen.getByText("Cargando historial de cierres…")).toBeInTheDocument();
    expect(screen.queryByText("Sin movimientos.")).not.toBeInTheDocument();
  });

  it("bloquea una confirmación abierta si falla la revalidación", () => {
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Cerrar embarque" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Confirmación" }), { target: { value: "CERRAR" } });
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar embarque" })).toBeEnabled();
    m.error = true;
    rerender(view());
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar embarque" })).toBeDisabled();
    expect(m.cerrar).not.toHaveBeenCalled();
  });
});
