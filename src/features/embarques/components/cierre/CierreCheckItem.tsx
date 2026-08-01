/**
 * v13.89.2 — Tarjeta accionable por check del cierre.
 * v13.90.10 — Drilldown: la fila completa es clickeable cuando hay ruta.
 * v13.106.1 — Modo `informativo`: para embarques ya cerrados, los checks no
 *             ok se muestran en muted (sin rojo) y sin link, ya que no hay
 *             acción que tomar sobre un embarque cerrado.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, MinusCircle, XCircle } from "lucide-react";
import { getCierreCheckMeta } from "@/features/embarques/utils/cierreCheckMeta";

interface Props {
  regla: string;
  ok: boolean;
  detalle?: unknown;
  embarqueId: string;
  /** v13.385.0 — Expediente del embarque (para enlaces a módulos externos). */
  expediente?: string;
  /** Si true, los checks no-ok se muestran en muted y sin link. */
  informativo?: boolean;
  /**
   * v13.384.0 — Motivo por el que el check aún no es evaluable (p. ej. no hay
   * facturas todavía). Si viene definido se muestra en gris "No aplica aún".
   */
  motivoNoAplica?: string;
}

type Estado = "no_aplica_aun" | "ok" | "informativo" | "pendiente";

function resolverEstado(ok: boolean, informativo: boolean, noAplica: boolean): Estado {
  if (noAplica) return "no_aplica_aun";
  if (ok) return "ok";
  if (informativo) return "informativo";
  return "pendiente";
}

const ICONOS: Record<Estado, { Icon: typeof CheckCircle2; color: string }> = {
  no_aplica_aun: { Icon: MinusCircle, color: "text-muted-foreground" },
  ok: { Icon: CheckCircle2, color: "text-success" },
  informativo: { Icon: MinusCircle, color: "text-muted-foreground" },
  pendiente: { Icon: XCircle, color: "text-destructive" },
};

const BADGES: Record<Estado, { variant: "outline" | "secondary" | "destructive"; label: string }> = {
  no_aplica_aun: { variant: "outline", label: "No aplica aún" },
  ok: { variant: "secondary", label: "OK" },
  informativo: { variant: "outline", label: "No aplica" },
  pendiente: { variant: "destructive", label: "Pendiente" },
};

export function CierreCheckItem({
  regla,
  ok,
  detalle,
  embarqueId,
  expediente,
  informativo = false,
  motivoNoAplica,
}: Props) {
  const noAplica = Boolean(motivoNoAplica);
  const meta = getCierreCheckMeta(regla);
  const detalleTxt = noAplica ? null : meta.formatDetalle(detalle);

  const clickeable = !ok && !informativo && !noAplica && meta.ruta != null;
  const href = clickeable && meta.ruta ? meta.ruta(embarqueId, detalle, expediente) : null;

  const estado = resolverEstado(ok, informativo, noAplica);
  const { Icon, color } = ICONOS[estado];
  const estadoBadge = BADGES[estado];

  const inner = (
    <>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-medium ${noAplica ? "text-muted-foreground" : ""}`}>
              {meta.label}
            </p>
            <Badge variant="outline" className="text-2xs font-normal">
              {meta.responsable}
            </Badge>
          </div>
          {meta.descripcion && (
            <p className="text-xs leading-snug text-muted-foreground">{meta.descripcion}</p>
          )}
          {noAplica && (
            <p className="text-xs text-muted-foreground">{motivoNoAplica}</p>
          )}

          {detalleTxt && (
            <p className="text-xs font-medium text-foreground/80">{detalleTxt}</p>
          )}

        </div>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
        {href && (
          <ExternalLink
            className="h-3.5 w-3.5 text-muted-foreground opacity-60"
            aria-hidden="true"
          />
        )}
      </div>
    </>
  );

  const baseCls = `flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between${
    noAplica ? " border-dashed bg-muted/30" : ""
  }`;


  if (href) {
    return (
      <li>
        <Link
          to={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`${meta.ctaLabel} (nueva pestaña)`}
          className={`${baseCls} cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        >
          {inner}
        </Link>
      </li>
    );
  }

  return <li className={baseCls}>{inner}</li>;
}
