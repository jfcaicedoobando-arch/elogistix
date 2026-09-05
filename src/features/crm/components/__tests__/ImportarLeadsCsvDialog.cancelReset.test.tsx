import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImportarLeadsCsvDialog from "@/features/crm/components/ImportarLeadsCsvDialog";
import type { ParsedLeadRow } from "@/lib/csv/leadsCsv";

let mockRows: ParsedLeadRow[] = [];
let mockFileName = "";
let mockValidRows: ParsedLeadRow[] = [];
const mockReset = vi.fn(() => {
  mockRows = [];
  mockFileName = "";
  mockValidRows = [];
});

vi.mock("@/features/crm/hooks", () => ({
  useImportarLeadsCsv: () => ({
    rows: mockRows,
    fileName: mockFileName,
    validRows: mockValidRows,
    errorCount: 0,
    isPending: false,
    duplicados: [],
    duplicadosCargando: false,
    duplicadosError: false,
    puedeImportar: mockValidRows.length > 0,
    reintentarDuplicados: vi.fn(),
    reset: mockReset,
    handleFile: vi.fn(),
    handleImport: vi.fn(),
  }),
}));

const filaEjemplo: ParsedLeadRow = {
  empresa: "Acme",
  contacto: "Juan Pérez",
  email: "juan@acme.com",
  telefono: "",
  ciudad: "CDMX",
  pais: "México",
  fuente: "Otro" as const,
  estado: "Nuevo" as const,
  score: 3,
  notas: "",
};

describe("ImportarLeadsCsvDialog — cancelar limpia el estado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows = [];
    mockFileName = "";
    mockValidRows = [];
  });

  it("al cancelar y reabrir se limpian archivo y preview", () => {
    const onOpenChange = vi.fn();
    mockRows = [filaEjemplo];
    mockValidRows = [filaEjemplo];
    mockFileName = "leads.csv";

    const { rerender } = render(<ImportarLeadsCsvDialog open onOpenChange={onOpenChange} />);

    expect(screen.getByText("leads.csv")).toBeTruthy();
    expect(screen.getByText(/1 filas leídas/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Simula que el padre cierra y vuelve a abrir el diálogo.
    rerender(<ImportarLeadsCsvDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<ImportarLeadsCsvDialog open onOpenChange={onOpenChange} />);

    expect(screen.queryByText("leads.csv")).toBeNull();
    expect(screen.queryByText(/1 filas leídas/i)).toBeNull();
    expect(screen.getByText(/Selecciona un archivo .csv/i)).toBeTruthy();
  });
});
