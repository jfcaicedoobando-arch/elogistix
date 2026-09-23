import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResumenConceptosVentaTotales } from "../ResumenConceptosVentaTotales";

const totales = {
  pendiente: { totalUsd: 0, totalMxn: 100 },
  enProforma: { totalUsd: 0, totalMxn: 0 },
  facturado: { totalUsd: 0, totalMxn: 100 },
};

describe("ResumenConceptosVentaTotales", () => {
  it("no afirma IVA cuando el grupo sólo tiene exento o no objeto", () => {
    render(<ResumenConceptosVentaTotales
      totales={totales} pendientesCount={1} enProformaCount={0} facturadosCount={1}
      gruposConIva={{ pendiente: false, enProforma: false, facturado: false }}
    />);
    expect(screen.queryByText(/IVA incluido/)).not.toBeInTheDocument();
  });

  it("aclara IVA incluido sólo en el grupo que realmente causa IVA", () => {
    render(<ResumenConceptosVentaTotales
      totales={totales} pendientesCount={1} enProformaCount={0} facturadosCount={1}
      gruposConIva={{ pendiente: true, enProforma: false, facturado: false }}
    />);
    expect(screen.getByText("Total · IVA incluido")).toBeInTheDocument();
    expect(screen.getByText("Conceptos vinculados")).toBeInTheDocument();
    expect(screen.getByText("Borrador o emitida")).toBeInTheDocument();
  });

  it("nombra conceptos vinculados sin presentarlos como conteo de documentos", () => {
    render(<ResumenConceptosVentaTotales
      totales={totales} pendientesCount={1} enProformaCount={0} facturadosCount={1}
      gruposConIva={{ pendiente: false, enProforma: false, facturado: false }}
    />);
    expect(screen.getByText("Conceptos en proforma")).toBeInTheDocument();
    expect(screen.getByText("Sin conceptos vinculados a proforma")).toBeInTheDocument();
    expect(screen.getByText("Conceptos en factura")).toBeInTheDocument();
    expect(screen.queryByText("Sin proformas generadas")).not.toBeInTheDocument();
  });
});