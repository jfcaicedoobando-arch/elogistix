/**
 * MNY-P2.6 — la ruta manual conserva `truncado`: el panel avisa que la
 * búsqueda quedó recortada en vez de afirmar "sin candidatos" y sigue
 * permitiendo conciliar los candidatos visibles.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListaCandidatos } from "../PanelConciliacionEstados";
import type { Candidato } from "@/features/tesoreria/services/sugerirCandidatos";

const candidato: Candidato = {
  tipo: "cxc",
  pago_id: "p1",
  fecha: "2026-09-01",
  referencia: "REF-1",
  monto: 1000,
  moneda: "MXN",
  contraparte: "Cliente Uno",
  delta_dias: 0,
  delta_monto: 0,
};

function renderLista(props: Partial<Parameters<typeof ListaCandidatos>[0]> = {}) {
  render(
    <ListaCandidatos
      candidatos={[]}
      hasData
      isLoading={false}
      isFetching={false}
      isError={false}
      onRetry={vi.fn()}
      isPending={false}
      onConciliar={vi.fn()}
      onIgnorar={vi.fn()}
      {...props}
    />,
  );
}

describe("ListaCandidatos (MNY-P2.6)", () => {
  it("sin resultados confirmados pide comprobar el pago antes de registrarlo", () => {
    renderLista();
    expect(screen.getByText(/Revisa en Cobranza o Compras si el pago ya está registrado/i)).toBeInTheDocument();
    expect(screen.queryByText(/Crea el pago manualmente/i)).not.toBeInTheDocument();
  });

  it("sin resultados y búsqueda recortada avisa que puede haber más", () => {
    renderLista({ truncado: true });
    expect(screen.queryByText(/Sin candidatos/i)).toBeNull();
    expect(screen.getByText(/no se alcanzaron a leer/i)).toBeInTheDocument();
  });

  it("con resultados recortados avisa y conserva el botón de conciliar", () => {
    renderLista({ candidatos: [candidato], truncado: true });
    expect(screen.getByText(/Lista recortada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Conciliar$/i })).toBeEnabled();
  });
});
