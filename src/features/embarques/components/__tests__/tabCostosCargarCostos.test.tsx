/**
 * B1 (v13.823.395): «Cargar costos» depende de la capacidad estrecha
 * `canEditCostos`, no del `canEdit` genérico. Los roles operativos que sólo
 * LEEN costos no deben ver la acción de captura.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

const renderTab = (canEditCostos: boolean) =>
  render(
    <MemoryRouter>
      <TabCostos
        conceptosCosto={[]}
        totalVenta={0}
        totalCosto={0}
        utilidad={0}
        margen={0}
        embarqueId="emb-1"
        canEditCostos={canEditCostos}
      />
    </MemoryRouter>,
  );

describe("TabCostos · acción «Cargar costos»", () => {
  it("la muestra a quien puede editar costos", () => {
    renderTab(true);
    expect(screen.getByRole("button", { name: /Cargar costos/i })).toBeInTheDocument();
  });

  it("la oculta a los roles operativos de sólo lectura de costos", () => {
    renderTab(false);
    expect(screen.queryByRole("button", { name: /Cargar costos/i })).toBeNull();
  });
});
