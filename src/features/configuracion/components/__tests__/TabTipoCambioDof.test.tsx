import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TabTipoCambioDof from "../TabTipoCambioDof";

const mutate = vi.fn();
const refetch = vi.fn();
const historial = [
  {
    fecha: "2026-07-28",
    usd_mxn: 17.4312,
    eur_mxn: 19.9389,
    fuente: "banxico",
    origen: "automatico",
    updated_at: "2026-07-28T13:05:00Z",
  },
  {
    fecha: "2026-07-27",
    usd_mxn: 17.5,
    eur_mxn: null,
    fuente: "manual",
    origen: "manual",
    updated_at: "2026-07-27T13:05:00Z",
  },
];

vi.mock("@/features/catalogos/hooks/useTipoCambioDof", () => ({
  useHistorialTcDof: () => ({ data: historial, isLoading: false, refetch, isFetching: false }),
  useUpsertTcDofManual: () => ({ mutate, isPending: false }),
}));

describe("TabTipoCambioDof", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra la última publicación y ambos orígenes", () => {
    render(<TabTipoCambioDof />);
    expect(screen.getByText("Tipo de Cambio DOF")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Automático")).toBeInTheDocument();
    expect(screen.getAllByText("17.4312").length).toBeGreaterThan(0);
    // El día sin EUR muestra guion largo.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("no guarda si el USD capturado es inválido", () => {
    render(<TabTipoCambioDof />);
    fireEvent.change(screen.getByPlaceholderText("17.4312"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar captura manual/i }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("guarda captura manual con EUR opcional vacío", () => {
    render(<TabTipoCambioDof />);
    fireEvent.change(screen.getByPlaceholderText("17.4312"), { target: { value: "18.25" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar captura manual/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ usdMxn: 18.25, eurMxn: null }),
      expect.anything(),
    );
  });

  it("guarda captura manual con EUR válido y permite refrescar", () => {
    render(<TabTipoCambioDof />);
    fireEvent.change(screen.getByPlaceholderText("17.4312"), { target: { value: "18.25" } });
    fireEvent.change(screen.getByPlaceholderText("19.9389"), { target: { value: "20.5" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar captura manual/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ usdMxn: 18.25, eurMxn: 20.5 }),
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
