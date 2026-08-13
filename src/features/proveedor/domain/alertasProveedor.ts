/**
 * Construcción de alertas accionables del proveedor (Ola 4).
 * Separado de `inteligenciaProveedor.ts` para mantener archivos ≤200 líneas.
 */
import type { AlertasProveedor } from "./inteligenciaProveedor";

export type SeveridadAlerta = "critica" | "media" | "info";

export interface AlertaProveedor {
  id: string;
  severidad: SeveridadAlerta;
  titulo: string;
  detalle: string;
  montoMxn?: number;
}

const ORDEN_SEVERIDAD: Record<SeveridadAlerta, number> = { critica: 0, media: 1, info: 2 };

const plural = (n: number, singular: string, pluralTxt: string) => (n === 1 ? singular : pluralTxt);

/** Alertas críticas: dinero vencido o pagos bloqueados. */
function alertasCriticas(a: AlertasProveedor): AlertaProveedor[] {
  const out: AlertaProveedor[] = [];
  if (a.facturasVencidas.count > 0) {
    const n = a.facturasVencidas.count;
    out.push({
      id: "vencidas",
      severidad: "critica",
      titulo: `${n} ${plural(n, "factura vencida", "facturas vencidas")}`,
      detalle: "Ya pasó la fecha de vencimiento y siguen con saldo.",
      montoMxn: a.facturasVencidas.montoMxn,
    });
  }
  if (a.bancariosIncompletos && a.saldoPendienteMxn > 0) {
    out.push({
      id: "bancarios",
      severidad: "critica",
      titulo: "Datos bancarios incompletos",
      detalle:
        "Hay saldo por pagar y faltan datos para transferir. Complétalos antes de programar el pago.",
      montoMxn: a.saldoPendienteMxn,
    });
  }
  return out;
}

/** Alertas medias: brechas de facturación y expediente fuera de vigencia. */
function alertasMedias(a: AlertasProveedor): AlertaProveedor[] {
  const out: AlertaProveedor[] = [];
  if (a.cerradosSinFactura.count > 0) {
    const n = a.cerradosSinFactura.count;
    out.push({
      id: "cerrados_sin_factura",
      severidad: "media",
      titulo: `${n} ${plural(n, "partida", "partidas")} de embarques cerrados sin factura`,
      detalle:
        "Costo comprometido en embarques ya cerrados que el proveedor no ha facturado.",
      montoMxn: a.cerradosSinFactura.montoMxn,
    });
  }
  if (a.documentosVencidos > 0) {
    const n = a.documentosVencidos;
    out.push({
      id: "docs_vencidos",
      severidad: "media",
      titulo: `${n} ${plural(n, "documento vencido", "documentos vencidos")}`,
      detalle: "El expediente tiene documentos fuera de vigencia.",
    });
  }
  return out;
}

/** Alertas informativas: vencimientos próximos. */
function alertasInfo(a: AlertasProveedor): AlertaProveedor[] {
  const out: AlertaProveedor[] = [];
  if (a.facturasPorVencer.count > 0) {
    const n = a.facturasPorVencer.count;
    out.push({
      id: "por_vencer",
      severidad: "info",
      titulo: `${n} ${plural(n, "factura", "facturas")} por vencer`,
      detalle: "Vencen en los próximos 7 días.",
      montoMxn: a.facturasPorVencer.montoMxn,
    });
  }
  if (a.documentosPorVencer > 0) {
    const n = a.documentosPorVencer;
    out.push({
      id: "docs_por_vencer",
      severidad: "info",
      titulo: `${n} ${plural(n, "documento", "documentos")} por vencer`,
      detalle: "Vencen en los próximos 30 días.",
    });
  }
  return out;
}

/** Convierte los contadores de la RPC en alertas accionables ordenadas por severidad. */
export function construirAlertas(a: AlertasProveedor): AlertaProveedor[] {
  return [...alertasCriticas(a), ...alertasMedias(a), ...alertasInfo(a)].sort(
    (x, y) => ORDEN_SEVERIDAD[x.severidad] - ORDEN_SEVERIDAD[y.severidad],
  );
}
