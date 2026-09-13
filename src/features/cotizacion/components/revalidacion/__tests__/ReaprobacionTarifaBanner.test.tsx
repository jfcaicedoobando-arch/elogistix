import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReaprobacionTarifaBanner } from "../ReaprobacionTarifaBanner";

const estado = vi.hoisted(() => ({ rol: "vendedor" }));

vi.mock("@/features/cotizacion/hooks/useRevalidacionTarifa", () => ({
  useResolverReaprobacion: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false }),
}));
vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canWriteCotizaciones: ["vendedor", "admin"].includes(estado.rol) }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    estado.rol = "vendedor";
  });

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

  /**
   * v13.823.349 — resolver la re-aprobación es escritura de cotizaciones: los
   * roles financieros/lectura ven el aviso pero no botones que la RPC rechaza.
   */
  it.each(["viewer", "contador", "tesorero"])("oculta las acciones para %s", (rol) => {
    estado.rol = rol;
    renderBanner({ cotizacionId: "c1", estado: "pendiente_reaprobacion" });
    expect(screen.getByText(/Tarifa pendiente de re-aprobación/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Re-aprobar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Rechazar/ })).toBeNull();
  });
});
