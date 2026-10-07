import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

// Contrato SQL legacy: el rechazo conserva su payload como actividad no verificada.
function rechazoLegacy(motivo: unknown): EventoHistorialFactura {
  return evento({
    ts: "2026-10-04T10:01:00Z", tipo: "actividad", descripcion: "Rechazo registrado en bitácora",
    actor_email: "rechazo@test.local", monto: null, moneda: null,
    detalles: {
      total: 116, moneda: "MXN", motivo_rechazo: motivo,
      accion_registrada: "rechazar_factura_proveedor", origen: "bitacora", fuente_evento: null,
      procedencia_verificada: false, snapshot_historico_disponible: false,
    },
  });
}

describe("HistorialFacturaSection: snapshots históricos", () => {
  beforeEach(() => { state.eventos = []; });

  it("separa datos declarados MXN de una decisión verificada USD y conserva la actividad legacy", () => {
    state.eventos = [
      evento({ monto: null, moneda: null,
        detalles: { procedencia_verificada: true, snapshot_historico_disponible: false } }),
      evento({ tipo: "actividad", descripcion: "Captura registrada en bitácora", monto: null, moneda: null,
        detalles: { total: 116, moneda: "MXN", procedencia_verificada: false, snapshot_historico_disponible: false } }),
      evento({ tipo: "actividad", descripcion: "Aprobación registrada en bitácora", monto: null, moneda: null,
        detalles: { total: 116, procedencia_verificada: false, snapshot_historico_disponible: false } }),
      evento({ tipo: "actividad", descripcion: "Edición registrada en bitácora", monto: null, moneda: null,
        detalles: { total: 116, moneda: "USD", procedencia_verificada: false, snapshot_historico_disponible: false } }),
      evento({ tipo: "aprobada", descripcion: "Factura aprobada", moneda: "USD",
        detalles: { procedencia_verificada: true, snapshot_historico_disponible: true } }),
    ];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText(`Importe declarado en bitácora: ${formatCurrency(116, "MXN")}.`)).toBeVisible();
    expect(screen.getByText(`Importe declarado en bitácora: ${formatCurrency(116, "USD")}.`)).toBeVisible();
    expect(screen.getByText(formatCurrency(116, "USD"))).toBeVisible();
    expect(screen.getAllByText("Factura aprobada")).toHaveLength(1);
    expect(screen.getByText("Aprobación registrada en bitácora")).toBeVisible();
    expect(screen.getAllByText("Datos de bitácora; procedencia no verificable.")).toHaveLength(3);
    expect(screen.getAllByText("Importe o moneda de este evento no disponibles.")).toHaveLength(4);
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
    state.eventos = [evento({ tipo: "actividad", descripcion: "Aprobación registrada en bitácora", monto: null, moneda: null,
      detalles: { total: 116, procedencia_verificada: false, snapshot_historico_disponible: false } })];
    render(<HistorialFacturaSection facturaId="legacy" />);
    expect(screen.queryByText(formatCurrency(116, "MXN"))).not.toBeInTheDocument();
    expect(screen.getByText("Importe o moneda de este evento no disponibles.")).toBeVisible();
    expect(screen.getByText(/Importe declarado en bitácora:.*moneda no registrada/)).toBeVisible();
  });

  it("conserva el motivo de un rechazo verificado", () => {
    state.eventos = [evento({ tipo: "rechazada", descripcion: "Factura rechazada",
      detalles: { motivo_rechazo: "Documento incorrecto", procedencia_verificada: true } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Motivo: Documento incorrecto")).toBeVisible();
    expect(screen.queryByText(/Motivo declarado en bitácora:/)).not.toBeInTheDocument();
  });

  it("conserva el motivo declarado del rechazo legacy tras una reaprobación verificada", () => {
    state.eventos = [rechazoLegacy("Factura ilegible"),
      evento({ ts: "2026-10-04T10:02:00Z", tipo: "aprobada", descripcion: "Factura aprobada", moneda: "USD",
        detalles: { accion_registrada: "aprobar_factura_proveedor", fuente_evento: "rpc_aprobar_factura_proveedor",
          procedencia_verificada: true, snapshot_historico_disponible: true } }),
    ];
    render(<HistorialFacturaSection facturaId="fixture" />);
    const motivo = screen.getByText("Motivo declarado en bitácora: Factura ilegible");
    expect(motivo).toBeVisible();
    const rechazo = motivo.closest("li")!;
    expect(within(rechazo).getByText("Rechazo registrado en bitácora")).toBeVisible();
    expect(within(rechazo).getByText("Datos de bitácora; procedencia no verificable.")).toBeVisible();
    expect(within(rechazo).queryByText("Motivo: Factura ilegible")).not.toBeInTheDocument();
    expect(within(rechazo).queryByText("Factura rechazada")).not.toBeInTheDocument();
    expect(rechazo.querySelector("svg")).toHaveClass("text-muted-foreground");
    expect(rechazo.querySelector("svg")).not.toHaveClass("text-destructive");
    expect(screen.getByText("Factura aprobada")).toBeVisible();
    expect(screen.getByText(formatCurrency(116, "USD"))).toBeVisible();
  });

  it("muestra el motivo declarado aunque la bitácora no tenga importe", () => {
    const rechazo = rechazoLegacy("Motivo original");
    state.eventos = [{ ...rechazo, detalles: { ...rechazo.detalles, total: null, moneda: null } }];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Motivo declarado en bitácora: Motivo original")).toBeVisible();
    expect(screen.queryByText(/Importe declarado en bitácora:/)).not.toBeInTheDocument();
  });

  it("no clasifica una actividad genérica con motivo como un rechazo legacy", () => {
    const actividad = rechazoLegacy("Texto de edición");
    state.eventos = [{ ...actividad, detalles: { ...actividad.detalles, accion_registrada: "editar" } }];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.queryByText(/Motivo declarado en bitácora:/)).not.toBeInTheDocument();
  });

  it.each([null, 42, true, [], {}, "", "   "])("no renderiza un motivo JSON no textual o vacío (%j)", (motivo) => {
    state.eventos = [rechazoLegacy(motivo), evento({ tipo: "rechazada", descripcion: "Factura rechazada",
      detalles: { motivo_rechazo: motivo, procedencia_verificada: true } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.queryByText(/Motivo declarado en bitácora:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Motivo:/)).not.toBeInTheDocument();
  });

  it("los pagos con fecha de negocio e importe conservados no reciben el aviso de snapshot", () => {
    state.eventos = [evento({ tipo: "pago", descripcion: "Pago registrado",
      detalles: { fecha_pago: "2026-10-03" } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Fecha de pago: 03/10/2026")).toBeVisible();
    expect(screen.queryByText("Importe o moneda de este evento no disponibles.")).not.toBeInTheDocument();
  });

  it("el ajuste tipificado conserva importe y fecha, sin icono ni etiqueta de dinero pagado", () => {
    const ajuste = evento({ tipo: "pago", descripcion: "Ajuste no monetario registrado", monto: 1,
      detalles: { pago_id: "ajuste", es_ajuste: true, motivo_ajuste: "condonacion", fecha_pago: "2026-10-03" } });
    state.eventos = [ajuste];
    const { container } = render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Ajuste no monetario registrado")).toBeVisible();
    expect(screen.getByText("Fecha del ajuste: 03/10/2026")).toBeVisible();
    expect(screen.getByText("MXN 1.00")).toBeVisible();
    expect(container.querySelector(".lucide-banknote")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fecha de pago:/)).not.toBeInTheDocument();
    expect(ajuste.detalles).toEqual({ pago_id: "ajuste", es_ajuste: true, motivo_ajuste: "condonacion", fecha_pago: "2026-10-03" });
  });

  it.each([undefined, false, "true"])("no interpreta textos libres ni flags no booleanos como ajuste (%j)", (es_ajuste) => {
    state.eventos = [evento({ tipo: "pago", descripcion: "Pago registrado · ref Cierre sin pago: condonacion",
      detalles: { es_ajuste, metodo_pago: "Ajuste", referencia: "Cierre sin pago: condonacion", fecha_pago: "2026-10-03" } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Fecha de pago: 03/10/2026")).toBeVisible();
    expect(screen.queryByText(/Fecha del ajuste:/)).not.toBeInTheDocument();
  });

  it("mantiene separado el fallback persistido y la actividad legacy de la misma fecha", () => {
    state.eventos = [
      evento({ tipo: "actividad", descripcion: "Aprobación registrada en bitácora", monto: null, moneda: null,
        detalles: { total: 999, moneda: "USD", procedencia_verificada: false, snapshot_historico_disponible: false } }),
      evento({ tipo: "aprobada", descripcion: "Factura aprobada", monto: null, moneda: null,
        detalles: { origen: "registro_factura", procedencia_verificada: true, snapshot_historico_disponible: false } }),
    ];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getAllByText("Factura aprobada")).toHaveLength(1);
    expect(screen.getByText("Aprobación registrada en bitácora")).toBeVisible();
    expect(screen.queryByText(formatCurrency(999, "USD"))).not.toBeInTheDocument();
    expect(screen.getByText(`Importe declarado en bitácora: ${formatCurrency(999, "USD")}.`)).toBeVisible();
  });

  it.each([null, "ilegible", [], {}, Number.NaN, Number.POSITIVE_INFINITY])("no convierte datos genéricos inválidos en importe declarado (%j)", (total) => {
    state.eventos = [evento({ tipo: "actividad", descripcion: "Registro legacy", monto: null, moneda: null,
      detalles: { total, procedencia_verificada: false, snapshot_historico_disponible: false } })];
    render(<HistorialFacturaSection facturaId="fixture" />);
    expect(screen.getByText("Datos de bitácora; procedencia no verificable.")).toBeVisible();
    expect(screen.queryByText(/Importe declarado en bitácora:/)).not.toBeInTheDocument();
  });
});
