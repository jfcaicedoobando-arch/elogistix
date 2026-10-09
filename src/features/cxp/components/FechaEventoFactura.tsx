import { formatDateTimeShort, formatFechaDia } from "@/lib/formatters";
import type { EventoHistorialFactura } from "@/features/cxp/services/historialFactura";

/** El día del pago es DATE; ts es el instante real de registro, no su conversión. */
export function FechaEventoFactura({ ev }: { ev: EventoHistorialFactura }) {
  if (ev.tipo !== "pago") return <span>{formatDateTimeShort(ev.ts)}</span>;
  const etiquetaFecha = ev.detalles?.es_ajuste === true ? "Fecha del ajuste" : "Fecha de pago";
  const fechaPago = typeof ev.detalles?.fecha_pago === "string" ? ev.detalles.fecha_pago : null;
  const fecha = formatFechaDia(fechaPago);
  // Cliente nuevo/servidor anterior: no inventar el día ni la hora de registro.
  if (fecha === "—") return <span>{etiquetaFecha} no disponible</span>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span>{etiquetaFecha}: {fecha}</span>
      <span>Registrado: {formatDateTimeShort(ev.ts)}</span>
    </span>
  );
}
