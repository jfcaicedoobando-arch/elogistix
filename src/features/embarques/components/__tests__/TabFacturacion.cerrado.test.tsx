/**
 * v13.334.8 — Un embarque Cerrado bloquea la edición de conceptos a nivel BD.
 * La UI no debe ofrecer acciones de facturación que fallarían con error 23514.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabFacturacion } from "../TabFacturacion";
import type { Tables } from "@/types/db";

vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/embarques/hooks", () => ({
  useEmbarqueConceptosVenta: () => ({
    data: [{ id: "c1", estado_facturacion: "pendiente", proforma_id: null }],
  }),
  useContenedoresEmbarque: () => ({ data: [] }),
  useProformasEmbarque: () => ({ data: [] }),
  useEliminarProforma: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDescargarProformaPdf: () => ({ descargar: vi.fn() }),
}));
vi.mock("@/features/embarques/hooks/useFocusSection", () => ({
  useFocusSection: () => ({ registerRef: () => undefined }),
}));
vi.mock("../facturacion/ResumenConceptosVenta", () => ({
  ResumenConceptosVenta: ({ canEdit }: { canEdit: boolean }) => (
    <div data-testid="resumen">{String(canEdit)}</div>
  ),
}));
vi.mock("../facturacion/HistorialProformas", () => ({
  HistorialProformas: ({ canEdit }: { canEdit: boolean }) => (
    <div data-testid="historial">{String(canEdit)}</div>
  ),
}));
vi.mock("../facturacion/HistorialFacturas", () => ({ HistorialFacturas: () => null }));
vi.mock("../DialogGenerarProforma", () => ({ DialogGenerarProforma: () => null }));
vi.mock("../facturacion/DialogEliminarProforma", () => ({ DialogEliminarProforma: () => null }));

const embarqueBase = { id: "e1", estado: "En Tránsito" } as unknown as Tables<"embarques">;

describe("TabFacturacion — embarque cerrado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite editar cuando el embarque no está cerrado", () => {
    render(<TabFacturacion facturas={[]} canEdit embarque={embarqueBase} />);
    expect(screen.getByTestId("resumen")).toHaveTextContent("true");
    expect(screen.getByTestId("historial")).toHaveTextContent("true");
    expect(screen.queryByText("Embarque cerrado")).toBeNull();
    expect(screen.getByText("Generar proforma")).toBeInTheDocument();
  });

  it("bloquea la edición y muestra aviso cuando el embarque está Cerrado", () => {
    render(
      <TabFacturacion
        facturas={[]}
        canEdit
        embarque={{ ...embarqueBase, estado: "Cerrado" } as Tables<"embarques">}
      />,
    );
    expect(screen.getByTestId("resumen")).toHaveTextContent("false");
    expect(screen.getByTestId("historial")).toHaveTextContent("false");
    expect(screen.getByText("Embarque cerrado")).toBeInTheDocument();
    expect(screen.queryByText("Generar proforma")).toBeNull();
  });
});
