import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComisionPendiente } from "../../services/recalculoPendiente";
const mocks = vi.hoisted(() => ({ pendientes: vi.fn(), reprocesar: vi.fn() }));
vi.mock("../../hooks/useComisionesPendientes", () => ({
  useComisionesPendientes: () => ({ data: mocks.pendientes() }),
  useReprocesarComisionesPendientes: () => ({ mutate: mocks.reprocesar, isPending: false }),
}));
import { AlertaComisionesPendientes } from "../AlertaComisionesPendientes";
const pendiente = (etapa: string, motivo = "Sin embarque"): ComisionPendiente => ({
  id: etapa, pago_factura_id: "p", etapa, motivo, intentos: 0, created_at: "2026-10-03",
});

describe("47 · diagnóstico de comisión no calculada", () => {
  beforeEach(() => vi.clearAllMocks());
  it("sin embarque explica la revisión aplicable y no ofrece recálculo de costos o TC", () => {
    mocks.pendientes.mockReturnValue([pendiente("consolidada_sin_embarque")]);
    render(<AlertaComisionesPendientes />);
    expect(screen.getByText("1 cobro sin embarque asociado")).toBeInTheDocument();
    expect(screen.getByText(/qué regla de comisión aplica/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar recálculo" })).not.toBeInTheDocument();
    expect(screen.queryByText(/tipos de cambio|costos del embarque/)).not.toBeInTheDocument();
  });
  it("en una cola mixta separa el conteo y muestra el motivo real del recálculo", () => {
    mocks.pendientes.mockReturnValue([
      pendiente("consolidada_sin_embarque"), pendiente("cobrado_mxn", "No se pudo valuar lo cobrado a MXN"),
    ]);
    render(<AlertaComisionesPendientes />);
    expect(screen.getByText("1 cobro sin embarque asociado")).toBeInTheDocument();
    expect(screen.getByText("1 comisión pendiente de recálculo")).toBeInTheDocument();
    expect(screen.getByText("No se pudo valuar lo cobrado a MXN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar recálculo" }));
    expect(mocks.reprocesar).toHaveBeenCalledOnce();
  });
  it("no muestra aviso si la cola está vacía", () => {
    mocks.pendientes.mockReturnValue([]);
    const { container } = render(<AlertaComisionesPendientes />);
    expect(container).toBeEmptyDOMElement();
  });
});
