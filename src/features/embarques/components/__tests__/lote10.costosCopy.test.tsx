/**
 * P2-7 (etiquetas presupuestadas sin cambiar cifras) y P3-9 (copy del vacío).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/features/embarques/hooks", () => ({ useContenedoresEmbarque: () => ({ data: [] }) }));
vi.mock("@/features/embarques/hooks/useReconciliacionEmbarque", () => ({ useReconciliacionEmbarque: () => ({ data: [] }) }));
vi.mock("../costos/AnticiposEmbarqueCard", () => ({ AnticiposEmbarqueCard: () => null }));
const permisos = { role: "admin" };
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => permisos }));
vi.mock("@/components/shared/OrgContextoHint", () => ({ OrgContextoHint: () => null }));

import { TabCostos } from "../TabCostos";
import { EmbarquesEmptyState } from "../EmbarquesEmptyState";

describe("P2-7 TabCostos", () => {
  it("usa etiquetas presupuestadas y conserva las cifras", () => {
    render(
      <MemoryRouter>
        <TabCostos conceptosCosto={[]} totalVenta={61638.16} totalCosto={53137.53} utilidad={8500.63}
          margen={13.79} montosSinTipoCambio={0} embarqueId="emb-mty" />
      </MemoryRouter>,
    );
    for (const l of ["Venta presupuestada", "Costo presupuestado", "Utilidad estimada", "Margen estimado"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
    expect(screen.queryByText("Total Costo")).toBeNull();
    expect(screen.getByText(/53,137\.53/)).toBeInTheDocument();
    expect(screen.getByTestId("nota-kpis-presupuesto")).toHaveTextContent(/conciliación/);
  });
});

describe("P3-9 EmbarquesEmptyState", () => {
  it.each(["admin", "coordinador_logistico"])("explica el flujo desde cotización para %s", (role) => {
    permisos.role = role;
    render(<MemoryRouter><EmbarquesEmptyState canEdit={false} onCreate={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/Los embarques se crean desde una cotización aceptada/)).toBeInTheDocument();
    expect(screen.queryByText(/no crearlos/)).toBeNull();
  });
});
