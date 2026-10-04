import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatCurrency } from "@/lib/formatters";
import type { EventoHistorialFactura } from "@/features/cxp/services/historialFactura";

const state = vi.hoisted(() => ({ eventos: [] as unknown[] }));
vi.mock("@/features/cxp/hooks/useHistorialFactura", () => ({
  useHistorialFactura: () => ({ data: state.eventos, isLoading: false, isFetching: false, isError: false }),
}));
vi.mock("@/components/shared/documento/DocumentoRailCard", () => ({
  DocumentoRailCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import { HistorialFacturaSection } from "../HistorialFacturaSection";

function evento(overrides: Partial<EventoHistorialFactura>): EventoHistorialFactura {
  return {
    ts: "2026-10-04T10:00:00Z", tipo: "creada", descripcion: "Factura capturada",
    actor_email: "captura@test.local", monto: 116, moneda: "MXN", detalles: {}, ...overrides,
  };
}

describe("HistorialFacturaSection: snapshots históricos", () => {
  beforeEach(() => { state.eventos = []; });

  it("conserva MXN en la captura y muestra las dos aprobaciones después de una edición USD", () => {
    state.eventos = [
      evento({ detalles: { snapshot_historico_disponible: true } }),
      evento({ tipo: "aprobada", descripcion: "Factura aprobada", moneda: null,
        detalles: { snapshot_historico_disponible: false } }),
      evento({ tipo: "editar", descripcion: "Factura editada", moneda: "USD" }),
      evento({ tipo: "aprobada", descripcion: "Factura aprobada", moneda: "USD" }),
    ];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText(formatCurrency(116, "MXN"))).toBeVisible();
    expect(screen.getAllByText(formatCurrency(116, "USD"))).toHaveLength(2);
    expect(screen.getAllByText("Factura aprobada")).toHaveLength(2);
    expect(screen.getAllByText("Importe o moneda de este evento no disponibles.")).toHaveLength(1);
  });

  it("no presenta el valor actual como importe de una captura sin snapshot", () => {
    state.eventos = [evento({ monto: null, moneda: null,
      detalles: { snapshot_historico_disponible: false } })];
    render(<HistorialFacturaSection facturaId="legacy" />);
    expect(screen.getByText("Factura capturada")).toBeVisible();
    expect(screen.queryByText(/116/)).not.toBeInTheDocument();
    expect(screen.getByText("Importe o moneda de este evento no disponibles.")).toBeVisible();
  });

  it("no deduce MXN para una aprobación cuyo payload antiguo carece de moneda", () => {
    state.eventos = [evento({ tipo: "aprobada", descripcion: "Factura aprobada", moneda: null,
      detalles: { total: 116, snapshot_historico_disponible: false } })];
    render(<HistorialFacturaSection facturaId="legacy" />);
    expect(screen.queryByText(formatCurrency(116, "MXN"))).not.toBeInTheDocument();
    expect(screen.getByText("Importe o moneda de este evento no disponibles.")).toBeVisible();
  });

  it("conserva el motivo histórico del rechazo", () => {
    state.eventos = [evento({ tipo: "rechazada", descripcion: "Factura rechazada",
      detalles: { motivo_rechazo: "Documento incorrecto" } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Motivo: Documento incorrecto")).toBeVisible();
  });

  it("los pagos con fecha de negocio e importe conservados no reciben el aviso de snapshot", () => {
    state.eventos = [evento({ tipo: "pago", descripcion: "Pago registrado",
      detalles: { fecha_pago: "2026-10-03" } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Fecha de pago: 03/10/2026")).toBeVisible();
    expect(screen.queryByText("Importe o moneda de este evento no disponibles.")).not.toBeInTheDocument();
  });
});
