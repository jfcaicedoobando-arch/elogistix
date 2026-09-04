import { MailQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/formatters";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import type { CotizacionSinRespuestaRow } from "@/features/crm/hooks";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";

interface Props {
  items: CotizacionSinRespuestaRow[];
  isError?: boolean;
  onRetry?: () => void;
}

export function CotizacionesSinRespuestaCard({ items, isError = false, onRetry }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <MailQuestion className="h-4 w-4 text-primary" /> Cotizaciones sin respuesta (&gt; 5 días)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorStateInline message="No se pudieron cargar las cotizaciones sin respuesta." onRetry={onRetry} />
        ) : items.length === 0 ? (
          <p className="text-body text-muted-foreground text-center py-4">
            Todas las cotizaciones recientes han tenido respuesta
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.slice(0, 5).map((c) => {
              const href = c.oportunidad_id
                ? `/crm/oportunidades/${c.oportunidad_id}`
                : `/cotizaciones/${c.id}`;
              return (
                <DrilldownRow
                  key={c.id}
                  as="li"
                  href={href}
                  ariaLabel={`Ver cotización ${c.folio}`}
                  className="flex items-center justify-between text-body py-1 border-b last:border-0 hover:bg-muted/40 rounded-sm"
                >
                  <div className="flex flex-col truncate">
                    <span className="font-medium truncate max-w-[260px]">
                      {c.folio} · {c.cliente_nombre || "Sin cliente"}
                    </span>
                    <span className="text-body-sm text-muted-foreground">
                      Enviada hace {c.dias} días
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-body-sm tabular-nums font-semibold">
                      {formatCurrencyCompact(c.subtotal, c.moneda)}
                    </div>
                    <Badge variant="outline" className="text-label mt-0.5">
                      {c.dias}d
                    </Badge>
                  </div>
                </DrilldownRow>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
