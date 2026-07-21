/**
 * v13.303.75 · Fase 1 · DataTable distingue error de red vs. lista vacía.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "../DataTable";

describe("DataTable · isError branch", () => {
  it("muestra ErrorStateInline con Reintentar cuando isError=true", () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={[{ id: "x", header: "X", accessorKey: "x" }]}
        data={[]}
        isError
        onRetry={onRetry}
        rowKey={(r: { x: number }) => String(r.x)}
      />,
    );
    // El bloque de error se pinta y NO el empty-state "Sin resultados".
    expect(screen.queryByText(/sin resultados/i)).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /reintentar/i });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("no muestra paginación cuando isError=true", () => {
    render(
      <DataTable
        columns={[{ id: "x", header: "X", accessorKey: "x" }]}
        data={[]}
        isError
        pagination={{
          page: 0,
          totalPages: 3,
          onPageChange: () => {},
          pageSize: 10,
          onPageSizeChange: () => {},
        }}
        rowKey={(r: { x: number }) => String(r.x)}
      />,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
