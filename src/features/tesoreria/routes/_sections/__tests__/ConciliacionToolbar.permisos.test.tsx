import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { ConciliacionToolbar } from "@/features/tesoreria/routes/_sections/ConciliacionToolbar";

/**
 * Espejo UI de la política RLS de `bbva_movimientos`: sólo tesorería y los
 * administradores pueden capturar/importar movimientos. Antes la UI ofrecía la
 * acción a cualquier rol de finanzas (p.ej. contador) y la base respondía 42501.
 */
function renderToolbar(puedeCapturar: boolean) {
  return render(
    <ConciliacionToolbar
      cuentas={[{ id: "c1", banco: "BBVA", alias: "Principal", moneda: "MXN" }]}
      cuentaId="c1"
      onCuentaChange={vi.fn()}
      estado="Pendiente"
      onEstadoChange={vi.fn()}
      pendientesCount={2}
      isAutoConciliando={false}
      onConciliarExactos={vi.fn()}
      onAbrirManual={vi.fn()}
      fileRef={createRef<HTMLInputElement>()}
      onFile={vi.fn()}
      importando={false}
      puedeCapturar={puedeCapturar}
    />,
  );
}

describe("<ConciliacionToolbar /> permisos de captura", () => {
  it("muestra movimiento manual e importar cuando el rol puede capturar", () => {
    renderToolbar(true);
    expect(screen.getByRole("button", { name: /movimiento manual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /importar/i })).toBeInTheDocument();
  });

  it("oculta las acciones de escritura y explica por qué cuando el rol es de lectura", () => {
    renderToolbar(false);
    expect(screen.queryByRole("button", { name: /movimiento manual/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /importar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/sólo tesorería puede capturar/i)).toBeInTheDocument();
  });
});
