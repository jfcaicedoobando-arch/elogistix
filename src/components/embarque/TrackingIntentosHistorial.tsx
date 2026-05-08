import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { useTrackingIntentos } from "@/hooks/embarque/useTrackingIntentos";


interface Props {
  embarqueId: string;
}

const RESULTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  exito: { label: "Éxito", variant: "default", icon: CheckCircle2 },
  duplicado: { label: "Duplicado (vinculado)", variant: "secondary", icon: CheckCircle2 },
  error: { label: "Error", variant: "destructive", icon: AlertCircle },
};

export function TrackingIntentosHistorial({ embarqueId }: Props) {
  const { data: intentos, isLoading } = useTrackingIntentos(embarqueId);

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historial de intentos de tracking
          {intentos && intentos.length > 0 && (
            <Badge variant="outline" className="ml-1">{intentos.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !intentos || intentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay intentos registrados. Activa el tracking para ver el historial aquí.
          </p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto pr-3">
            <ul className="space-y-2">
              {intentos.map((it) => {
                const meta = RESULTADO_BADGE[it.resultado] ?? RESULTADO_BADGE.error;
                const Icon = meta.icon;
                return (
                  <li
                    key={it.id}
                    className="border rounded-md p-2.5 text-xs space-y-1.5 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                        {it.http_status && (
                          <Badge variant="outline" className="font-mono">HTTP {it.http_status}</Badge>
                        )}
                        <span className="text-muted-foreground">
                          {formatDate(it.created_at, "dd MMM yyyy HH:mm:ss")}
                        </span>
                      </div>
                      {it.usuario_email && (
                        <span className="text-muted-foreground truncate max-w-[180px]" title={it.usuario_email}>
                          {it.usuario_email}
                        </span>
                      )}
                    </div>

                    {it.mensaje && (
                      <p className="text-foreground leading-snug">{it.mensaje}</p>
                    )}

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                      {it.scac && <span>SCAC: <span className="font-mono">{it.scac}</span></span>}
                      {it.request_number && (
                        <span>
                          {it.request_type === "container" ? "Cont." : "BL"}:{" "}
                          <span className="font-mono">{it.request_number}</span>
                        </span>
                      )}
                      {it.tracking_request_id && (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(it.tracking_request_id!)}
                          className="font-mono inline-flex items-center gap-1 hover:text-foreground"
                          title="Copiar tracking_request_id"
                        >
                          <Copy className="h-3 w-3" />
                          {it.tracking_request_id.slice(0, 8)}…
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
