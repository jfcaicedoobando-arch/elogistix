/**
 * Regresión v13.823.227: el estado del lead es sólo lectura en la tabla.
 * La edición vive exclusivamente en el detalle del lead.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeLeadsColumns } from "../leadsColumns";
import type { CrmLeadRow } from "@/features/crm/hooks";

const lead = {
  id: "l1",
  empresa: "ACME",
  estado: "Nuevo",
  score: 3,
  vendedor_id: "u1",
} as unknown as CrmLeadRow;

const renderEstado = () => {
  const cols = makeLeadsColumns(new Set(), () => {}, () => {}, [lead], {
    puedeSeleccionar: false,
  });
  const col = cols.find((c) => c.id === "estado");
  const cell = col?.cell as (ctx: unknown) => React.ReactElement;
  return render(cell({ row: { original: lead } }) as React.ReactElement);
};

describe("leadsColumns · estado", () => {
  it("muestra el estado como etiqueta de lectura", () => {
    renderEstado();
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("no expone selector de estado en la tabla", () => {
    renderEstado();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
