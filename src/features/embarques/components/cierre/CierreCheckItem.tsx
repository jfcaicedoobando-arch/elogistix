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
  /** Si true, los checks no-ok se muestran en muted y sin link. */
  informativo?: boolean;
}

export function CierreCheckItem({ regla, ok, detalle, embarqueId, informativo = false }: Props) {
  const meta = getCierreCheckMeta(regla);
  const detalleTxt = meta.formatDetalle(detalle);
  const clickeable = !ok && !informativo && meta.ruta != null;
  const href = clickeable && meta.ruta ? meta.ruta(embarqueId, detalle) : null;

  const renderIcon = () => {
    if (ok) return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />;
    if (informativo) return <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;
    return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />;
  };

  const estadoBadge = ok
    ? { variant: "secondary" as const, label: "OK" }
    : informativo
      ? { variant: "outline" as const, label: "No aplica" }
      : { variant: "destructive" as const, label: "Pendiente" };

  const inner = (
    <>
      <div className="flex items-start gap-2">
        {renderIcon()}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{meta.label}</p>
            <Badge variant="outline" className="text-2xs font-normal">
              {meta.responsable}
            </Badge>
          </div>
          {meta.descripcion && (
            <p className="text-xs leading-snug text-muted-foreground">{meta.descripcion}</p>
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

  const baseCls =
    "flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between";

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
