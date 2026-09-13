/**
 * Regresión (v13.823.336): el contador de resultados podía leerse como "0 de 1".
 * Ahora habla español natural y sólo muestra el rango cuando es real.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PaginationControls from "@/components/shared/PaginationControls";

const base = {
  page: 0,
  totalPages: 1,
  onPageChange: () => {},
  pageSize: 20,
  onPageSizeChange: () => {},
};

describe("PaginationControls · contador de resultados", () => {
  it("sin resultados no muestra un rango numérico", () => {
    render(<PaginationControls {...base} total={0} />);
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument();
    expect(screen.queryByText(/0 de 1/)).toBeNull();
  });

  it("con un solo registro lo dice en singular", () => {
    render(<PaginationControls {...base} total={1} />);
    expect(screen.getByText(/1 registro/)).toBeInTheDocument();
  });

  it("con varios registros muestra el rango de la página", () => {
    render(<PaginationControls {...base} total={45} totalPages={3} />);
    expect(screen.getByText(/1–20 de 45 registros/)).toBeInTheDocument();
  });

  it("sin tamaño de página muestra sólo el total", () => {
    render(
      <PaginationControls
        page={0}
        totalPages={1}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        total={7}
      />,
    );
    expect(screen.getByText(/7 registros/)).toBeInTheDocument();
  });
});
