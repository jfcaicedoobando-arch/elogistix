import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevalidarTarifaModal } from "@/features/cotizacion/components/revalidacion/RevalidarTarifaModal";
import type { ResultadoRevalidacion } from "@/features/cotizacion/domain/revalidacionTarifa";

function baseRes(over: Partial<ResultadoRevalidacion> = {}): ResultadoRevalidacion {
  return {
    tarifa_vigente: true,
    agente_sin_cupo: false,
    severidad: "informativa",
    cambios: [
      {
        concepto: "Flete",
        moneda: "USD",
        monto_anterior: 100,
        monto_actual: 103,
        delta_abs: 3,
        delta_pct: 3,
      },
    ],
    umbral_pct: 5,
    max_delta_pct: 3,
    ...over,
  };
}

describe("RevalidarTarifaModal", () => {
  it("no renderiza nada si resultado es null", () => {
    const { container } = render(
      <RevalidarTarifaModal
        open
        onOpenChange={() => {}}
        resultado={null}
        onMantener={() => {}}
        onRefrescar={() => {}}
        onSolicitarReaprobacion={() => {}}
      />,
    );
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("severidad informativa muestra botones Mantener y Refrescar", () => {
    const onMantener = vi.fn();
    const onRefrescar = vi.fn();
    render(
      <RevalidarTarifaModal
        open
        onOpenChange={() => {}}
        resultado={baseRes()}
        onMantener={onMantener}
        onRefrescar={onRefrescar}
        onSolicitarReaprobacion={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /mantener costos/i }));
    expect(onMantener).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /refrescar desde tarifa/i }));
    expect(onRefrescar).toHaveBeenCalled();
  });

  it("severidad bloqueante sólo muestra solicitar re-aprobación", () => {
    const onReaprob = vi.fn();
    render(
      <RevalidarTarifaModal
        open
        onOpenChange={() => {}}
        resultado={baseRes({ severidad: "bloqueante", tarifa_vigente: false })}
        onMantener={() => {}}
        onRefrescar={() => {}}
        onSolicitarReaprobacion={onReaprob}
      />,
    );
    expect(screen.queryByRole("button", { name: /refrescar/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /re-aprobación/i }));
    expect(onReaprob).toHaveBeenCalled();
  });

  it("renderiza filas de cambios con badge 'Eliminado' cuando motivo=eliminado", () => {
    render(
      <RevalidarTarifaModal
        open
        onOpenChange={() => {}}
        resultado={baseRes({
          cambios: [
            {
              concepto: "BAF",
              moneda: "USD",
              monto_anterior: 50,
              monto_actual: null,
              delta_abs: null,
              delta_pct: null,
              motivo: "eliminado",
            },
          ],
        })}
        onMantener={() => {}}
        onRefrescar={() => {}}
        onSolicitarReaprobacion={() => {}}
      />,
    );
    expect(screen.getByText(/BAF/)).toBeInTheDocument();
    expect(screen.getByText(/Eliminado/i)).toBeInTheDocument();
  });
});

describe("RevalidarTarifaModal · operación en curso (busy)", () => {
  it("con loading marca aria-busy y no cierra con Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <RevalidarTarifaModal
        open
        onOpenChange={onOpenChange}
        resultado={baseRes()}
        onMantener={() => {}}
        onRefrescar={() => {}}
        onSolicitarReaprobacion={() => {}}
        loading
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("sin loading cierra normalmente con Cancelar", () => {
    const onOpenChange = vi.fn();
    render(
      <RevalidarTarifaModal
        open
        onOpenChange={onOpenChange}
        resultado={baseRes()}
        onMantener={() => {}}
        onRefrescar={() => {}}
        onSolicitarReaprobacion={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
