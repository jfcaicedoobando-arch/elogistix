/**
 * El agente debe ver, en su propia lista, que su borrador ya tiene la vigencia
 * vencida (antes sólo decía "Borrador" y parecía aprobable).
 */
import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { buildAgenteTarifasColumns } from "../agenteTarifasColumns";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";

function fila(vigenteHasta: string): AgenteTarifaRow {
  return {
    id: "t1",
    naviera_id: "n1",
    naviera_nombre: "MAERSK",
    ruta_id: "r1",
    puerto_origen_nombre: "Shanghai",
    puerto_destino_nombre: "Manzanillo",
    tipo_contenedor_id: "c1",
    tipo_contenedor_nombre: "40HC",
    flete_base: 1000,
    vigente_desde: "2026-07-01",
    vigente_hasta: vigenteHasta,
    dias_libres_demoras: 7,
    transit_time_dias: 28,
    notas: null,
    estado: "vigente",
    estado_aprobacion: "borrador",
    motivo_rechazo: null,
  } as unknown as AgenteTarifaRow;
}

function renderEstado(vigenteHasta: string) {
  const cols = buildAgenteTarifasColumns({ onEditar: vi.fn(), onDuplicar: vi.fn() });
  const col = cols.find((c) => c.id === "estado");
  expect(col).toBeTruthy();
  const cell = col?.cell as (ctx: { row: { original: AgenteTarifaRow } }) => ReactElement;
  render(<>{cell({ row: { original: fila(vigenteHasta) } })}</>);
}

describe("agenteTarifasColumns — aviso de vigencia", () => {
  it("muestra advertencia cuando el borrador ya venció", () => {
    renderEstado("2000-01-01");
    expect(screen.getByText(/vigencia vencida/i)).toBeTruthy();
  });

  it("no muestra advertencia cuando la vigencia sigue activa", () => {
    renderEstado("2999-12-31");
    expect(screen.queryByText(/vigencia vencida/i)).toBeNull();
  });
});
