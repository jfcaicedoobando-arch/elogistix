/**
 * @deprecated Usar `<StatusBadge domain="cotizacion" />` directamente.
 * Conservado para la celda compuesta (estado + vigencia + badges extra).
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";
import { todayLocalISO } from "@/lib/date/today";

function buildVigenciaNode(fechaVigencia: string, estado: string): ReactNode {
  const fechaStr = formatDate(fechaVigencia);
  const esEnviada = estado.toLowerCase() === "enviada";
  const fecha = new Date(fechaVigencia);
  const diffDias = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // v13.223.0 · Capa 3 Tranche A · 3.3: la fila de "Vence" ya no aparece
  // siempre. Sólo se muestra si la cotización está en proceso ("enviada")
  // o si el vencimiento está próximo/expirado (≤ 7 días). Reduce densidad
  // visual en la tabla sin ocultar los casos que requieren acción.
  if (!esEnviada && diffDias > 7) return null;

  if (diffDias < 0) {
    return <span className="text-destructive font-medium">Vencida · {fechaStr}</span>;
  }
  if (diffDias <= 3) {
    const txt = diffDias === 0 ? "Vence hoy" : `Vence en ${diffDias}d`;
    return <span className="text-warning font-medium">{txt} · {fechaStr}</span>;
  }
  if (diffDias <= 7) {
    return <span className="text-warning">Vence en {diffDias}d · {fechaStr}</span>;
  }
  return <span className="text-muted-foreground">Vence {fechaStr}</span>;
}

function isTarifaVencida(estado: string, vigHasta: string | null | undefined): boolean {
  if (!vigHasta) return false;
  if (estado.toLowerCase() !== "aceptada") return false;
  return new Date(vigHasta) < new Date(todayLocalISO());
}

/**
 * @deprecated Usar `<StatusBadge domain="cotizacion" />`.
 * Mantenido por la lógica de vigencia/badges secundarios (sinCostos, re-aprobación, tarifa vencida).
 */
export function renderEstadoVigencia(r: CotizacionListItem): ReactNode {
  const estado = r.estado || "—";
  const vigenciaNode = r.fecha_vigencia ? buildVigenciaNode(r.fecha_vigencia, estado) : null;
  const sinCostos = !!r.sin_desglose_costos && (r.cotizacion_costos_count ?? 0) === 0;
  const vigHasta = (r as { tarifa_vigente_hasta?: string | null }).tarifa_vigente_hasta;
  const tarifaVencida = isTarifaVencida(estado, vigHasta);
  const requiereReaprobacion =
    (r as { estado_revalidacion?: string }).estado_revalidacion === "pendiente_reaprobacion";
  const esSolicitudPortal = !!(r as { origen_portal?: boolean | null }).origen_portal;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge domain="cotizacion" status={estado} />
        {esSolicitudPortal && (
          <Badge variant="info" className="w-fit text-2xs whitespace-nowrap"
            title="Solicitud capturada por el cliente desde su portal">
            Portal
          </Badge>
        )}
        {sinCostos && (
          <Badge variant="warning" className="w-fit text-2xs whitespace-nowrap">Sin costos</Badge>
        )}
        {requiereReaprobacion && (
          <Badge variant="warning" className="w-fit text-2xs whitespace-nowrap"
            title="Tarifa cambió: requiere re-aprobación de ventas">
            ⚠ Re-aprobación pendiente
          </Badge>
        )}
        {tarifaVencida && (
          <Badge variant="destructive" className="w-fit text-2xs whitespace-nowrap"
            title={`La tarifa vinculada venció el ${formatDate(vigHasta!)}`}>
            ⚠ Tarifa vencida
          </Badge>
        )}
      </div>
      {vigenciaNode && <span className="text-2xs whitespace-nowrap">{vigenciaNode}</span>}
    </div>
  );
}
