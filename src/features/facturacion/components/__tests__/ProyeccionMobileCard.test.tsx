/** Tarjeta móvil del tab Proyección muestra expediente, cliente, ETA, estado y venta. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProyeccionMobileCard } from "../ProyeccionMobileCard";
import type { GrupoProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";

function grupo(overrides: Partial<GrupoProyeccion> = {}): GrupoProyeccion {
  return {
    sinTc: false,
    expediente: "EXP-99",
    cliente_nombre: "cliente tres",
    operador: "op",
    eta: "2024-03-01",
    contenedores: ["C1"],
    totalContenedores: 1,
    ventaMxn: 2000,
    ventaUsd: 100,
    costoMxn: 1000,
    costoUsd: 50,
    profitMxn: 1000,
    profitUsd: 50,
    margenPct: 50,
    estado: "Pendiente",
    embarqueIds: ["e1"],
    ...overrides,
  };
}

describe("ProyeccionMobileCard", () => {
  it("muestra expediente, cliente, ETA, estado y venta MXN", () => {
    render(<ProyeccionMobileCard grupo={grupo()} />);
    expect(screen.getByText("EXP-99")).toBeInTheDocument();
    expect(screen.getByText("Cliente Tres")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText(/2,000\.00|2000\.00/)).toBeInTheDocument();
  });
});
