import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReaprobacionTarifaBanner } from "../ReaprobacionTarifaBanner";

vi.mock("@/features/cotizacion/hooks/useRevalidacionTarifa", () => ({
  useResolverReaprobacion: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/cotizacion/services/versionado", () => ({
  recotizarCotizacion: vi.fn(),
}));

function renderBanner(props: Parameters<typeof ReaprobacionTarifaBanner>[0]) {
  return render(
    <MemoryRouter>
      <ReaprobacionTarifaBanner {...props} />
    </MemoryRouter>,
  );
}

describe("ReaprobacionTarifaBanner (B-097)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no se pinta cuando la cotización no está pendiente de re-aprobación", () => {
    const { container } = renderBanner({ cotizacionId: "c1", estado: "Aceptada" });
    expect(container).toBeEmptyDOMElement();
  });

  it("usa copy de vigencia cuando la tarifa está vencida", () => {
    renderBanner({
      cotizacionId: "c1",
      estado: "pendiente_reaprobacion",
      deltaJsonb: { tarifa_vigente: false },
    });
    expect(screen.getByText(/tarifa vinculada está vencida/)).toBeInTheDocument();
  });

  it("usa copy de cambio de precio cuando la tarifa sigue vigente", () => {
    renderBanner({
      cotizacionId: "c1",
      estado: "pendiente_reaprobacion",
      deltaJsonb: { tarifa_vigente: true, conceptos: 3 },
    });
    expect(screen.getByText(/cambios en la tarifa vigente/)).toBeInTheDocument();
    expect(screen.getByText(/3 concepto\(s\) afectado\(s\)/)).toBeInTheDocument();
  });

  it("ofrece las tres decisiones de ventas", () => {
    renderBanner({ cotizacionId: "c1", estado: "pendiente_reaprobacion" });
    expect(screen.getByRole("button", { name: /Re-aprobar manteniendo precio/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Re-cotizar con tarifa vigente/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rechazar/ })).toBeInTheDocument();
  });
});
