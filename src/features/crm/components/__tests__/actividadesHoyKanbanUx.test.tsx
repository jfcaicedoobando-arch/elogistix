/**
 * Tercera tanda YAGNI:
 *  - hallazgo 2: "Mis actividades de hoy" no dice "Sin actividades" si la
 *    lectura falló; muestra error con reintento.
 *  - hallazgo 3: el Kanban expone una leyenda accesible de desplazamiento
 *    horizontal, sin tocar el drag & drop.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/crm/hooks", () => ({
  useProximasActividades: () => ({ data: new Map() }),
}));
vi.mock("@/features/crm/hooks/useCriteriosEtapa", () => ({
  useAvanceCriterios: () => ({ data: new Map() }),
}));
vi.mock("@/features/crm/components/kanban/ColumnaEtapa", () => ({
  default: ({ etapa }: { etapa: { nombre: string } }) => <div>{etapa.nombre}</div>,
}));
vi.mock("@/features/crm/components/kanban/PipelineResumen", () => ({
  default: () => <div data-testid="resumen" />,
}));

import { ActividadesHoyCard } from "@/features/crm/components/crmDashboard/ActividadesHoyCard";
import OportunidadKanban from "@/features/crm/components/OportunidadKanban";

describe("ActividadesHoyCard", () => {
  it("con error muestra aviso y reintento, no 'Sin actividades'", () => {
    const onRetry = vi.fn();
    render(<ActividadesHoyCard items={[]} isError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Sin actividades programadas hoy/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sin error y sin datos conserva el empty-state", () => {
    render(<ActividadesHoyCard items={[]} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Sin actividades programadas hoy/i)).toBeInTheDocument();
  });
});

describe("OportunidadKanban — affordance de desplazamiento", () => {
  it("expone leyenda y contenedor con scroll horizontal accesible", () => {
    render(
      <OportunidadKanban
        etapas={[]}
        oportunidades={[]}
        onMover={vi.fn()}
        onClickCard={vi.fn()}
      />,
    );
    expect(screen.getByText(/Desliza horizontalmente para ver más etapas/i)).toBeInTheDocument();
    const grupo = screen.getByRole("group", { name: /desplazamiento horizontal/i });
    expect(grupo.className).toContain("kanban-scroll");
    expect(grupo.className).toContain("overflow-x-auto");
  });
});
