import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { buildCotizacionesColumns } from "../cotizacionesColumns";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("buildCotizacionesColumns · prospecto", () => {
  it("da dos líneas al nombre y coloca el badge debajo", () => {
    const columnas = buildCotizacionesColumns({
      canDuplicar: false,
      canEliminar: false,
      onEliminar: () => {},
    });
    const cliente = columnas.find((columna) => columna.id === "cliente");
    if (!cliente?.cell || typeof cliente.cell !== "function") throw new Error("Falta columna Cliente");
    const original = {
      es_prospecto: true,
      prospecto_empresa: "MOCK MTY - Aceros Regiomontanos del Norte",
      cliente_nombre: "Prospecto",
    };
    // SAFE-CAST: la celda sólo consume row.original para pintar nombre y badge.
    const contexto = { row: { original } } as unknown as Parameters<typeof cliente.cell>[0];
    render(<TooltipProvider>{cliente.cell(contexto) as ReactNode}</TooltipProvider>);

    expect(screen.getByText(original.prospecto_empresa)).toHaveClass("line-clamp-2", "break-words");
    expect(screen.getByText("Prospecto")).toBeInTheDocument();
  });
});