import { Target, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCompact } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import {
  NBA_LEAD_SIN_CONTACTAR_HORAS,
  SEMANA_LEAD_SIN_CONTACTAR_DIAS,
} from "@/features/crm/domain/umbralesContacto";

interface DealItem {
  id: string;
  nombre: string;
  cliente_nombre?: string | null;
  monto_estimado: number;
  moneda: string;
  probabilidad: number;
  fecha_estimada_cierre?: string | null;
  ponderado?: number;
}

interface LeadItem {
  id: string;
  empresa: string;
  contacto?: string | null;
  fuente: string;
  created_at: string;
}

function ListEmpty({ msg }: { msg: string }) {
  return <p className="text-body text-muted-foreground text-center py-4">{msg}</p>;
}

interface EstadoProps {
  isError?: boolean;
  onRetry?: () => void;
}

export function CerrandoSemanaCard({ items, isError = false, onRetry }: { items: DealItem[] } & EstadoProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Cerrando esta semana
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorStateInline
            message="No se pudieron cargar las oportunidades por cerrar."
            onRetry={onRetry}
          />
        ) : items.length === 0 ? <ListEmpty msg="Sin oportunidades por cerrar" /> : (
          <ul className="space-y-1.5">
            {items.map((o) => (
              <DrilldownRow
                key={o.id}
                as="li"
                href={`/crm/oportunidades/${o.id}`}
                ariaLabel={`Ver oportunidad ${o.nombre}`}
                className="flex items-center justify-between text-body py-1 border-b last:border-0 hover:bg-muted/40 rounded-sm"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium truncate max-w-[260px]">{o.nombre}</span>
                  <span className="text-body-sm text-muted-foreground">{o.cliente_nombre || "Sin cliente"}</span>
                </div>
                <div className="text-right">
                  <div className="text-body-sm tabular-nums font-semibold">{formatCurrencyCompact(o.monto_estimado, o.moneda)}</div>
                  <div className="text-label text-muted-foreground">{o.fecha_estimada_cierre ? formatFechaEs(o.fecha_estimada_cierre) : "Sin fecha"} · {o.probabilidad}%</div>
                </div>
              </DrilldownRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadsSinContactarCard({ items, isError = false, onRetry }: { items: LeadItem[] } & EstadoProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Leads sin contactar (&gt;{" "}
          {SEMANA_LEAD_SIN_CONTACTAR_DIAS} días)
        </CardTitle>
        <p className="text-caption text-muted-foreground">
          Seguimiento semanal. En “Mi día”, las sugerencias avisan desde las{" "}
          {NBA_LEAD_SIN_CONTACTAR_HORAS} horas sin contacto.
        </p>

      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorStateInline
            message="No se pudieron cargar los leads sin contactar."
            onRetry={onRetry}
          />
        ) : items.length === 0 ? <ListEmpty msg="Todos los leads nuevos están atendidos" /> : (
          <ul className="space-y-1.5">
            {items.map((l) => (
              <DrilldownRow
                key={l.id}
                as="li"
                href={`/crm/leads/${l.id}`}
                ariaLabel={`Ver lead ${l.empresa}`}
                className="flex items-center justify-between text-body py-1 border-b last:border-0 hover:bg-muted/40 rounded-sm"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium truncate max-w-[260px]">{l.empresa}</span>
                  <span className="text-body-sm text-muted-foreground">{l.contacto || "Sin contacto"} · {l.fuente}</span>
                </div>
                <span className="text-body-sm text-muted-foreground">
                  {formatFechaEs(l.created_at)}
                </span>
              </DrilldownRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
