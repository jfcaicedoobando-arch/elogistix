/**
 * v13.89.2 — Tarjeta accionable por check del cierre.
 *
 * Reemplaza al `<li>` inline anterior. Muestra estado, etiqueta legible,
 * detalle formateado en español, chip de responsable y CTA "Resolver"
 * que lleva al tab correspondiente del mismo embarque.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
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
  const showCta = !ok && meta.ruta != null;
  const href = showCta && meta.ruta ? meta.ruta(embarqueId, detalle) : null;

  return (
    <li className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between">
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
          <Button asChild size="sm" variant="outline">
            <Link
              to={href}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en nueva pestaña"
            >
              {meta.ctaLabel}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
              <ExternalLink className="ml-1 h-3 w-3 opacity-60" />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
