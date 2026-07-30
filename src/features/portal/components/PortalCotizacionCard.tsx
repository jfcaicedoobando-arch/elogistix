import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { Ship } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { calcularDesgloseMoneda, parseConceptos } from "@/lib/domain/cotizacionDetalle";

/** Fila mínima que la tarjeta necesita del listado de cotizaciones del portal. */
export interface PortalCotizacionCardRow {
  id: string;
  folio: string;
  estado: string;
  modo: string;
  tipo: string;
  moneda: string;
  origen?: string | null;
  destino?: string | null;
  subtotal?: number | null;
  fecha_vigencia?: string | null;
  embarque_id?: string | null;
  embarque_expediente?: string | null;
  fecha_aceptacion?: string | null;
  fecha_rechazo?: string | null;
  conceptos_venta?: unknown;
}

interface Props {
  cotizacion: PortalCotizacionCardRow;
  tasaIva: number;
}

/** Deriva la etiqueta/fecha de respuesta y el total mostrado en la tarjeta. */
function derivarResumen(c: PortalCotizacionCardRow, tasaIva: number) {
  const fechaAceptacion = c.fecha_aceptacion ?? null;
  const fechaRechazo = c.fecha_rechazo ?? null;
  const fechaRespuesta = fechaAceptacion ?? fechaRechazo;
  let fechaRespuestaLabel: string | null = null;
  if (fechaAceptacion) fechaRespuestaLabel = "Aceptada";
  else if (fechaRechazo) fechaRespuestaLabel = "Rechazada";

  // B-099: mostrar el TOTAL de la moneda de la cotización (subtotal + IVA por
  // fila), igual que el detalle; fallback al subtotal crudo si la cotización
  // legacy no trae conceptos parseables.
  const conceptosMoneda = parseConceptos(c.conceptos_venta).filter((cv) => cv.moneda === c.moneda);
  const totalLista = conceptosMoneda.length > 0
    ? calcularDesgloseMoneda(conceptosMoneda, tasaIva, c.moneda === "MXN").total
    : Number(c.subtotal ?? 0);

  const expediente = c.embarque_expediente ?? null;
  return {
    expediente,
    tieneEmbarque: Boolean(c.embarque_id && expediente),
    fechaRespuesta,
    fechaRespuestaLabel,
    totalLista,
  };
}

/** Línea "Aceptada/Rechazada el …" del pie de la tarjeta. */
function LineaRespuesta({ fecha, label }: { fecha: string; label: string }) {
  // B-103: fecha date-only → sólo fecha (no "00:00").
  const formato = fecha.includes("T") ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy";
  return (
    <p className="text-2xs text-muted-foreground mt-0.5 tabular-nums">
      {label} el {formatDate(fecha, formato)}
    </p>
  );
}

/** Enlace al embarque cuando la cotización ya está en operación. */
function EnlaceEmbarque({ embarqueId, expediente }: { embarqueId: string; expediente: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/portal/embarques/${embarqueId}`);
      }}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success hover:underline"
    >
      <Ship className="h-3 w-3" />
      En operación · {expediente}
    </button>
  );
}

/**
 * Tarjeta de una cotización en el listado del portal. Extraída de
 * `PortalCotizaciones` para respetar el límite de 200 líneas (Power of 10).
 */
export function PortalCotizacionCard({ cotizacion: c, tasaIva }: Props) {
  const { expediente, tieneEmbarque, fechaRespuesta, fechaRespuestaLabel, totalLista } =
    derivarResumen(c, tasaIva);


  return (
    <Card className="transition-all hover:shadow-raised hover:border-accent/30 focus-within:ring-2 focus-within:ring-accent/40 group">
      <Link
        to={`/portal/cotizaciones/${c.id}`}
        aria-label={`Ver cotización ${c.folio}`}
        className="block focus:outline-none"
      >
        <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Badge className={`${getEstadoColor(c.estado)} text-xs shrink-0`}>{c.estado}</Badge>
            <div className="min-w-0">
              <p className="font-semibold text-sm font-mono tabular-nums">{c.folio}</p>
              <p className="text-xs text-muted-foreground truncate">
                {c.modo} • {c.tipo} • {c.origen || "—"} → {c.destino || "—"}
              </p>
              <p className="text-2xs text-muted-foreground mt-0.5">
                Vigencia: {c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "—"}
              </p>
              {fechaRespuesta && fechaRespuestaLabel && (
                <LineaRespuesta fecha={fechaRespuesta} label={fechaRespuestaLabel} />
              )}
              {tieneEmbarque && expediente && c.embarque_id && (
                <EnlaceEmbarque embarqueId={c.embarque_id} expediente={expediente} />
              )}

            </div>
          </div>
          <p className="text-sm font-bold tabular-nums shrink-0 text-right min-w-[110px]">
            {formatCurrency(totalLista, c.moneda)}
          </p>
        </CardContent>
      </Link>
    </Card>
  );
}
