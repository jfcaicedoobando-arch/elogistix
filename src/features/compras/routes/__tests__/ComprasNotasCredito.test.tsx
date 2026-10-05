import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import ComprasNotasCredito from "../ComprasNotasCredito";

const mocks = vi.hoisted(() => ({ isError: false }));
vi.mock("@/features/compras/hooks/useComprasNotasCreditoController", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/compras/hooks/useComprasNotasCreditoController")>();
  return { ...actual, useComprasNotasCreditoController: () => ({
    desde: "2026-01-01", hasta: "2026-10-04", moneda: "todas", estado: "todos", search: "",
    setDesde: vi.fn(), setHasta: vi.fn(), setMoneda: vi.fn(), setEstado: vi.fn(), setSearch: vi.fn(),
    rows: [], isLoading: false, isError: mocks.isError, refetch: vi.fn(),
    totalMxn: 0, totalUsd: 0, handleExport: vi.fn(),
  }) };
});
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <select>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));
vi.mock("@/components/ui/date-picker-mx", () => ({ DatePickerMx: () => null }));
vi.mock("@/components/shared/DataTable", () => ({ DataTable: () => <div>Tabla vacía</div>, defineColumns: (v: unknown) => v }));

beforeEach(() => { mocks.isError = false; });

describe("60: estados y KPI de notas de crédito", () => {
  it("ofrece Borrador/Aprobada/Aplicada/Cancelada y elimina Emitida", () => {
    render(<ComprasNotasCredito />);
    expect(screen.getByRole("option", { name: "Borrador" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Aprobada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Aplicada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cancelada" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Emitida" })).not.toBeInTheDocument();
  });
  it("un error muestra tres KPI no disponibles y no simula resultado cero", () => {
    mocks.isError = true;
    render(<ComprasNotasCredito />);
    expect(screen.getAllByText("No disponible")).toHaveLength(3);
    expect(screen.queryByText("Tabla vacía")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
  });
  it("un resultado vacío válido muestra los ceros y la tabla", () => {
    render(<ComprasNotasCredito />);
    expect(screen.queryByText("No disponible")).not.toBeInTheDocument();
    expect(screen.getByText("Tabla vacía")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
