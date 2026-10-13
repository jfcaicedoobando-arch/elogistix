import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PnlTipoCambioNota } from "../PnlTipoCambioNota";

const mockContexto = vi.fn();
vi.mock("@/features/embarques/hooks/useTcEmbarqueDof", () => ({
  useEmbarqueTcContexto: (...args: unknown[]) => mockContexto(...args),
}));
vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => ({ canEdit: true }),
}));
vi.mock("../PnlTcAlinearDialog", () => ({ PnlTcAlinearDialog: () => <button>Usar el del DOF</button> }));

describe("PnlTipoCambioNota", () => {
  it("no renderiza ni consulta contexto para un embarque sólo MXN", () => {
    mockContexto.mockClear();
    const { container } = render(
      <PnlTipoCambioNota embarqueId="emb-1" tcUsd={17} tcEur={19} monedas={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(mockContexto).not.toHaveBeenCalled();
  });

  it("muestra USD y su trazabilidad sin EUR sobrante", () => {
    mockContexto.mockReturnValue({ data: null });
    render(<PnlTipoCambioNota embarqueId="emb-2" tcUsd={17.25} tcEur={19} monedas={["USD"]} />);
    expect(screen.getByText(/USD 17\.2500/)).toBeTruthy();
    expect(screen.queryByText(/EUR 19\.0000/)).toBeNull();
  });

  it("muestra EUR cuando está presente", () => {
    mockContexto.mockReturnValue({ data: null });
    render(<PnlTipoCambioNota embarqueId="emb-3" tcUsd={17.25} tcEur={19.1} monedas={["EUR"]} />);
    expect(screen.getByText(/EUR 19\.1000/)).toBeTruthy();
    expect(screen.queryByText(/USD 17\.2500/)).toBeNull();
  });
});

const contexto = {
  embarqueId: "emb-1", expediente: "EXP-1", estado: "En tránsito", fechaReferencia: "2026-10-13",
  tcUsd: 20, tcEur: 22, dof: { fecha: "2026-10-13", usdMxn: 19, eurMxn: 21, exacto: true },
  desviacionPct: 100 / 19, fueraDeDof: true, editable: true,
};

describe("PnlTipoCambioNota: disponibilidad de la acción", () => {
  it("ofrece alinear un vivo confirmado y retira la acción al fallar el refetch con caché", () => {
    mockContexto.mockReturnValue({ data: contexto, isError: false, isFetching: false });
    const { rerender } = render(<PnlTipoCambioNota embarqueId="emb-1" tcUsd={20} tcEur={22} monedas={["USD"]} />);
    expect(screen.getByRole("button", { name: "Usar el del DOF" })).toBeTruthy();
    mockContexto.mockReturnValue({ data: contexto, isError: true, isFetching: false });
    rerender(<PnlTipoCambioNota embarqueId="emb-1" tcUsd={20} tcEur={22} monedas={["USD"]} />);
    expect(screen.queryByRole("button", { name: "Usar el del DOF" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/No se pudo verificar/);
    expect(screen.getByText(/USD 20\.0000/)).toBeTruthy();
    mockContexto.mockReturnValue({ data: contexto, isError: false, isFetching: false });
    rerender(<PnlTipoCambioNota embarqueId="emb-1" tcUsd={20} tcEur={22} monedas={["USD"]} />);
    expect(screen.getByRole("button", { name: "Usar el del DOF" })).toBeTruthy();
  });

  it("no permite actuar mientras revalida el contexto cacheado", () => {
    mockContexto.mockReturnValue({ data: contexto, isError: false, isFetching: true });
    render(<PnlTipoCambioNota embarqueId="emb-1" tcUsd={20} tcEur={22} monedas={["USD"]} />);
    expect(screen.queryByRole("button", { name: "Usar el del DOF" })).toBeNull();
  });

  it.each(["Cerrado", "Cancelado"])("muestra histórico %s sin acción", (estado) => {
    mockContexto.mockReturnValue({ data: { ...contexto, estado, editable: false }, isError: false });
    render(<PnlTipoCambioNota embarqueId="emb-1" tcUsd={20} tcEur={22} monedas={["USD"]} />);
    expect(screen.getByText(/DOF del/)).toBeTruthy();
    expect(screen.getByText(/el T\/C ya no puede cambiarse/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Usar el del DOF" })).toBeNull();
  });
});
