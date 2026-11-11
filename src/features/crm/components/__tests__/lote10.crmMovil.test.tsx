/** P1-2 · Acciones de actividad en móvil con permisos. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CrmActividadRow } from "@/features/crm/hooks";

vi.mock("@/features/crm/components/ActividadRowActions", () => ({
  default: () => <button type="button" aria-label="Marcar como completada">ok</button>,
}));

import { ActividadMobileCard } from "../ActividadMobileCard";

const actividad = {
  id: "a1", tipo: "llamada", entidad_tipo: "lead", asunto: "Llamar a Aceros del Norte",
  fecha_programada: "2026-09-30T16:00:00Z", fecha_completada: null, responsable_id: "u-vend",
} as unknown as CrmActividadRow;

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
