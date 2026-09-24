import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
import ResumenTotalesCotizacion from "../ResumenTotalesCotizacion";

describe("Nota fiscal de ResumenTotalesCotizacion", () => {
  it("0 conceptos: sin nota", () => {
    const { container } = render(
      <ResumenTotalesCotizacion totalUSD={0} totalMXN={0} ivaUSD={0} ivaMXN={0} mostrarUSD={false} mostrarMXN={false} />,
    );
    expect(container.textContent).not.toMatch(/IVA/);
  });
  it("IVA cero (p. ej. ObjetoImp 01): copy neutral, sin inferir tasa 0/exento", () => {
    render(<ResumenTotalesCotizacion totalUSD={0} totalMXN={5000} ivaUSD={0} ivaMXN={0} mostrarUSD={false} />);
    expect(screen.getByText("* Sin IVA trasladado en los conceptos mostrados.")).toBeInTheDocument();
    expect(screen.queryByText(/exentos|tasa 0%/)).toBeNull();
  });
  it("mezcla IVA16 + no objeto: conserva nota con IVA", () => {
    render(<ResumenTotalesCotizacion totalUSD={0} totalMXN={2160} ivaUSD={0} ivaMXN={160} mostrarUSD={false} />);
    expect(screen.getByText(/Los conceptos en MXN incluyen IVA/)).toBeInTheDocument();
    expect(screen.getByText(/Total MXN \(c\/IVA\)/)).toBeInTheDocument();
  });
});
