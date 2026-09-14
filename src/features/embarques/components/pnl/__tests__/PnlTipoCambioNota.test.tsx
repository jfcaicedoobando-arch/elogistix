import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PnlTipoCambioNota } from "../PnlTipoCambioNota";

const mockContexto = vi.fn();
vi.mock("@/features/embarques/hooks/useTcEmbarqueDof", () => ({
  useEmbarqueTcContexto: (...args: unknown[]) => mockContexto(...args),
}));
vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => ({ canEdit: false }),
}));
vi.mock("../PnlTcAlinearDialog", () => ({ PnlTcAlinearDialog: () => null }));

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