/**
 * v13.823.29 — En móvil (<md) las tarifas del agente se ven como tarjetas
 * (sin tabla, por tanto sin scroll horizontal a 390px); en desktop se conserva
 * la tabla con todas sus columnas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { buildAgenteTarifasColumns } from "../_sections/agenteTarifasColumns";
import { AgenteTarifaCard } from "../_sections/AgenteTarifaCard";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/shared", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useIsMobile: () => mobile.value,
}));

const fila = {
  id: "t1",
  naviera_id: "n1",
  naviera_nombre: "MAERSK",
  ruta_id: "r1",
  puerto_origen_nombre: "Shanghai",
  puerto_destino_nombre: "Manzanillo",
  tipo_contenedor_id: "c1",
  tipo_contenedor_nombre: "40HC",
  moneda: "USD",
  flete_base: 1500,
  vigente_desde: "2026-07-01",
  vigente_hasta: "2000-01-01",
  dias_libres_demoras: 7,
  transit_time_dias: 28,
  notas: null,
  estado: "vigente",
  estado_aprobacion: "borrador",
  motivo_rechazo: null,
} as unknown as AgenteTarifaRow;

function renderLista() {
  const columns = buildAgenteTarifasColumns({ onEditar: vi.fn(), onDuplicar: vi.fn() });
  render(
    <MemoryRouter>
      <ResponsiveDataTable<AgenteTarifaRow>
        columns={columns}
        data={[fila]}
        rowKey={(t) => t.id}
        mobileCard={(t) => (
          <AgenteTarifaCard t={t} onEditar={vi.fn()} onDuplicar={vi.fn()} />
        )}
      />
    </MemoryRouter>,
  );
}

describe("AgenteTarifas — responsive", () => {
  beforeEach(() => { mobile.value = true; });

  it("en móvil muestra tarjetas con los campos críticos y sin tabla", () => {
    renderLista();
    expect(document.querySelector("table")).toBeNull();
    expect(screen.getByText(/Shanghai → Manzanillo/)).toBeTruthy();
    expect(screen.getByText(/MAERSK · 40HC/)).toBeTruthy();
    expect(screen.getByText(/USD\s*1,500\.00/)).toBeTruthy();
    expect(screen.getByText(/01\/07\/26 → 01\/01\/00/)).toBeTruthy();
    expect(screen.getByText(/vigencia vencida/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Acciones de la tarifa Shanghai → Manzanillo/i }),
    ).toBeTruthy();
  });

  it("en desktop conserva la tabla con sus columnas", () => {
    mobile.value = false;
    renderLista();
    expect(document.querySelector("table")).not.toBeNull();
    expect(screen.getByText("Ruta")).toBeTruthy();
    expect(screen.getByText("Flete base")).toBeTruthy();
    expect(screen.getByText("Vigencia")).toBeTruthy();
  });
});
