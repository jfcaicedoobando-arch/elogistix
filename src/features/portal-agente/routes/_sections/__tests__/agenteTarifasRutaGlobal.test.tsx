/**
 * Etapa 6 — con rutas mundiales hay puertos homónimos (Valencia, España vs
 * Valencia, Venezuela). La tabla, el orden, el aria-label de acciones y la
 * tarjeta móvil deben mostrar "Nombre, País (UN/LOCODE)" para distinguirlos.
 */
import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { buildAgenteTarifasColumns } from "../agenteTarifasColumns";
import { AgenteTarifaCard } from "../AgenteTarifaCard";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";

function fila(over: Partial<AgenteTarifaRow>): AgenteTarifaRow {
  return {
    id: "t1",
    naviera_id: "n1",
    naviera_nombre: "MAERSK",
    ruta_id: "r1",
    tipo_contenedor_id: "c1",
    tipo_contenedor_nombre: "40HC",
    moneda: "USD",
    flete_base: 1500,
    vigente_desde: "2026-07-01",
    vigente_hasta: "2999-12-31",
    dias_libres_demoras: 7,
    transit_time_dias: 28,
    notas: null,
    estado: "vigente",
    estado_aprobacion: "borrador",
    motivo_rechazo: null,
    puerto_origen_nombre: "Shanghai",
    puerto_origen_code: "CNSHA",
    puerto_origen_country: "China",
    puerto_destino_nombre: "Valencia",
    puerto_destino_code: "ESVLC",
    puerto_destino_country: "España",
    ...over,
  } as unknown as AgenteTarifaRow;
}

const esVenezuela = fila({
  id: "t2",
  puerto_destino_code: "VEVLN",
  puerto_destino_country: "Venezuela",
});

interface ColumnaRuta {
  accessorFn: (t: AgenteTarifaRow) => string;
  cell: (ctx: { row: { original: AgenteTarifaRow } }) => ReactElement;
}

function columnaRuta(): ColumnaRuta {
  const cols = buildAgenteTarifasColumns({ onEditar: vi.fn(), onDuplicar: vi.fn() });
  const col = cols.find((c) => c.id === "ruta");
  expect(col).toBeTruthy();
  // SAFE-CAST: la columna "ruta" se define con accessorFn + cell en este mismo módulo.
  return col as unknown as ColumnaRuta;
}

describe("Tarifas del agente · ruta global inequívoca", () => {
  it("el accessor incluye país y UN/LOCODE de ambos puertos", () => {
    const acc = columnaRuta().accessorFn;
    expect(acc(fila({}))).toBe("Shanghai, China (CNSHA) → Valencia, España (ESVLC)");
    expect(acc(esVenezuela)).toBe("Shanghai, China (CNSHA) → Valencia, Venezuela (VEVLN)");
  });

  it("el orden distingue dos destinos homónimos de países distintos", () => {
    const acc = columnaRuta().accessorFn;
    expect(acc(fila({}))).not.toBe(acc(esVenezuela));
  });

  it("la celda de la tabla pinta la etiqueta completa", () => {
    const { cell } = columnaRuta();
    render(<>{cell({ row: { original: fila({}) } })}</>);
    expect(screen.getByText("Shanghai, China (CNSHA) → Valencia, España (ESVLC)")).toBeTruthy();
  });

  it("degrada sin comas ni paréntesis vacíos cuando falta país o código", () => {
    const acc = columnaRuta().accessorFn;
    const legacy = fila({
      puerto_origen_code: null,
      puerto_origen_country: null,
      puerto_destino_code: null,
      puerto_destino_country: null,
    });
    expect(acc(legacy)).toBe("Shanghai → Valencia");
  });

  it("la tarjeta móvil muestra país y UN/LOCODE, y el menú usa la etiqueta completa", () => {
    render(<AgenteTarifaCard t={esVenezuela} onEditar={vi.fn()} onDuplicar={vi.fn()} />);
    expect(screen.getByText("Shanghai, China (CNSHA) → Valencia, Venezuela (VEVLN)")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Acciones de la tarifa Shanghai, China (CNSHA) → Valencia, Venezuela (VEVLN)",
      }),
    ).toBeTruthy();
  });
});
