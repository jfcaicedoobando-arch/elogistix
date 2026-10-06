import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { baseActividadColumns } from "../../routes/actividadesColumns";
import { ActividadMobileCard } from "../ActividadMobileCard";
import { actividadEntidadHref } from "../../domain/actividadEntidad";
import type { CrmActividadRow } from "../../services/actividades";

const mocks = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => mocks.mobile }));
const actividad = { id: "a1", entidad_tipo: "oportunidad", entidad_id: "o1", entidad_nombre: "Resinas Ningbo–Altamira", entidad_estado: "disponible", asunto: "Confirmar cotización", tipo: "llamada", fecha_programada: null, fecha_completada: null } as CrmActividadRow;

function Tabla({ row = actividad }: { row?: CrmActividadRow }) {
  const l = useLocation();
  return <><output>{l.pathname}</output><ResponsiveDataTable columns={baseActividadColumns} data={[row]} rowKey={a => a.id} getRowHref={actividadEntidadHref} getRowAriaLabel={a => `Abrir ${a.entidad_nombre}`} mobileCard={a => <ActividadMobileCard actividad={a} />} /></>;
}
beforeEach(() => { mocks.mobile = false; });

describe.each([false, true])("drilldown de agenda mobile=%s", mobile => {
  it("muestra el nombre y abre la entidad con teclado", () => {
    mocks.mobile = mobile;
    render(<MemoryRouter initialEntries={["/crm/actividades"]}><Tabla /></MemoryRouter>);
    expect(screen.getByText("Resinas Ningbo–Altamira")).toBeInTheDocument();
    const row = screen.getByRole("link", { name: "Abrir Resinas Ningbo–Altamira" });
    expect(row).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByRole("status")).toHaveTextContent("/crm/oportunidades/o1");
  });

  it("no enlaza una entidad ausente ni presenta su nombre anterior", () => {
    mocks.mobile = mobile;
    render(<MemoryRouter><Tabla row={{ ...actividad, entidad_nombre: null, entidad_estado: "no_disponible" }} /></MemoryRouter>);
    expect(screen.getByText("Entidad no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
