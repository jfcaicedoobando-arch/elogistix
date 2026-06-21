/**
 * v13.89.2 — Tarjeta accionable por check del cierre.
 * v13.90.10 — Drilldown: la fila completa es clickeable cuando hay ruta.
 *             Se elimina el botón "Resolver" para alinear con el patrón
 *             de navegación por renglón que usa el resto de la app.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { getCierreCheckMeta } from "@/features/embarques/utils/cierreCheckMeta";

interface Props {
  regla: string;
  ok: boolean;
  detalle?: unknown;
  embarqueId: string;
}

export function CierreCheckItem({ regla, ok, detalle, embarqueId }: Props) {
  const meta = getCierreCheckMeta(regla);
  const detalleTxt = meta.formatDetalle(detalle);
  const clickeable = !ok && meta.ruta != null;
  const href = clickeable && meta.ruta ? meta.ruta(embarqueId, detalle) : null;

  const inner = (
    <>
      <div className="flex items-start gap-2">
        {ok ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        )}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{meta.label}</p>
            <Badge variant="outline" className="text-[10px] font-normal">
              {meta.responsable}
            </Badge>
          </div>
          {detalleTxt && (
            <p className="text-xs text-muted-foreground">{detalleTxt}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <Badge variant={ok ? "secondary" : "destructive"}>
          {ok ? "OK" : "Pendiente"}
        </Badge>
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
