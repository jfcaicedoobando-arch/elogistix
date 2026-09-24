/**
 * P1-2 (acciones de actividad en móvil con permisos), P1-3/P3-10 (casilla de
 * selección de lead en móvil y nombre accesible en escritorio).
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CrmActividadRow, CrmLeadRow } from "@/features/crm/hooks";

vi.mock("@/features/crm/components/ActividadRowActions", () => ({
  default: () => <button type="button" aria-label="Marcar como completada">ok</button>,
}));

import { ActividadMobileCard } from "../ActividadMobileCard";
import { LeadMobileCard } from "../LeadMobileCard";
import { makeLeadsColumns } from "@/features/crm/routes/leadsColumns";

const actividad = {
  id: "a1", tipo: "llamada", entidad_tipo: "lead", asunto: "Llamar a Aceros del Norte",
  fecha_programada: "2026-09-30T16:00:00Z", fecha_completada: null, responsable_id: "u-vend",
} as unknown as CrmActividadRow;

const lead = (id: string, empresa: string) =>
  ({ id, empresa, contacto: "Ana Garza", email: null, fuente: "Web", estado: "Nuevo", score: 3 }) as unknown as CrmLeadRow;

describe("P1-2 ActividadMobileCard", () => {
  it("con permiso muestra acciones", () => {
    render(<ActividadMobileCard actividad={actividad} puedeGestionar />);
    expect(screen.getByLabelText("Marcar como completada")).toBeInTheDocument();
  });
  it("sin permiso (actividad ajena) no muestra acciones", () => {
    render(<ActividadMobileCard actividad={actividad} puedeGestionar={false} />);
    expect(screen.queryByLabelText("Marcar como completada")).toBeNull();
  });
});

describe("P1-3 LeadMobileCard", () => {
  it("la casilla alterna selección sin propagar el toque a la tarjeta", () => {
    const onToggle = vi.fn(); const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <LeadMobileCard lead={lead("l1", "Aceros del Norte")} puedeSeleccionar seleccionado={false} onToggle={onToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar lead Aceros del Norte" }));
    expect(onToggle).toHaveBeenCalledWith("l1");
    expect(onCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/aceros del norte/i));
    expect(onCard).toHaveBeenCalled();
  });
  it("rol sin permiso no ve casilla", () => {
    render(<LeadMobileCard lead={lead("l1", "Aceros del Norte")} puedeSeleccionar={false} seleccionado={false} onToggle={() => {}} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("P3-10 leadsColumns", () => {
  it("cada casilla de escritorio tiene nombre accesible propio", () => {
    const rows = [lead("l1", "Aceros del Norte"), lead("l2", "Logística Regia")];
    const cols = makeLeadsColumns(new Set(), () => {}, () => {}, rows, { puedeSeleccionar: true });
    const cell = cols[0].cell as (ctx: unknown) => React.ReactElement;
    render(<>{rows.map((r) => <div key={r.id}>{cell({ row: { original: r } })}</div>)}</>);
    expect(screen.getByRole("checkbox", { name: "Seleccionar lead Aceros del Norte" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar lead Logística Regia" })).toBeInTheDocument();
  });
});
