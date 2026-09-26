/**
 * FIN-01: cuando `computeEmbarqueKpis` excluye conceptos en moneda extranjera
 * por falta de tipo de cambio, la pestaña de Costos debe avisarlo en pantalla.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { computeEmbarqueKpis } from "@/features/embarques/domain/embarqueKpis";

vi.mock("@/features/embarques/hooks", () => ({
  useContenedoresEmbarque: () => ({ data: [] }),
}));
vi.mock("@/features/embarques/hooks/useReconciliacionEmbarque", () => ({
  useReconciliacionEmbarque: () => ({ data: [] }),
}));
vi.mock("../costos/AnticiposEmbarqueCard", () => ({
  AnticiposEmbarqueCard: () => null,
}));

import { TabCostos } from "../TabCostos";

const renderConKpis = (tcUsd: number) => {
  const k = computeEmbarqueKpis(
    [{ total: 1000, moneda: "MXN" }, { total: 100, moneda: "USD" }],
    [],
    tcUsd,
    0,
  );
  render(
    <MemoryRouter>
      <TabCostos
        conceptosCosto={[]}
        totalVenta={k.totalVenta}
        totalCosto={k.totalCosto}
        utilidad={k.utilidad}
        margen={k.margen}
        montosSinTipoCambio={k.montosSinTipoCambio}
        tipoCambioUsd={tcUsd}
        monedasExtranjeras={["USD"]}
        embarqueId="emb-1"
      />
    </MemoryRouter>,
  );
  return k;
};

describe("TabCostos · aviso de tipo de cambio faltante", () => {
  it("excluye el concepto USD sin TC y muestra el aviso", () => {
    const k = renderConKpis(1);
    expect(k.totalVenta).toBe(1000);
    expect(k.montosSinTipoCambio).toBe(1);
    expect(screen.getByTestId("aviso-sin-tipo-cambio")).toBeInTheDocument();
    expect(screen.getByText(/Totales incompletos por falta de tipo de cambio/i)).toBeInTheDocument();
  });

  it("no muestra aviso con tipo de cambio válido", () => {
    const k = renderConKpis(17.5);
    expect(k.montosSinTipoCambio).toBe(0);
    expect(screen.queryByTestId("aviso-sin-tipo-cambio")).toBeNull();
    expect(screen.getByTestId("tipo-cambio-kpis")).toHaveTextContent("1 USD =");
    expect(screen.getByTestId("tipo-cambio-kpis")).toHaveTextContent("17.50");
  });
});
