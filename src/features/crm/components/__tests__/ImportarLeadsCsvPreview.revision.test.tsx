import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportarLeadsCsvPreview } from "../ImportarLeadsCsvPreview";
import type { ParsedLeadRow } from "@/lib/csv/leadsCsv";

const rows: ParsedLeadRow[] = [{
  empresa: "Acme", contacto: "Ana", email: "lead@example.test", telefono: "",
  ciudad: "", pais: "", fuente: "Prospección", estado: "Contactado", score: 3, notas: "",
}];
describe("estado de revisión en preview", () => {
  it("muestra Sin revisar cuando no existe clasificación", () => {
    render(<ImportarLeadsCsvPreview rows={rows} validCount={0} errorCount={0} />);
    expect(screen.getByText("Sin revisar")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).toBeNull();
  });
  it.each(["pendiente", "error"])("oculta clasificación vieja en estado %s", (estado) => {
    render(<ImportarLeadsCsvPreview rows={rows} validCount={0} errorCount={0}
      duplicados={[{ nivel: "nuevo", campos: [] }]}
      duplicadosCargando={estado === "pendiente"} duplicadosError={estado === "error"} />);
    expect(screen.getByText("Sin revisar")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).toBeNull();
  });
  it("muestra Nuevo únicamente con clasificación disponible", () => {
    render(<ImportarLeadsCsvPreview rows={rows} validCount={1} errorCount={0}
      duplicados={[{ nivel: "nuevo", campos: [] }]} />);
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
    expect(screen.queryByText("Sin revisar")).toBeNull();
  });
});
