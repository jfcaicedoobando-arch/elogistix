import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, BellOff } from "lucide-react";
import { useAlertasSistemaList, useAcknowledgeAlerta } from "@/hooks/admin";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const severityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
  critical: "destructive",
};

export default function AlertasSistemaPanel() {
  const [includeAck, setIncludeAck] = useState(false);
  const { data: alertas = [], isLoading } = useAlertasSistemaList(includeAck);
  const ackMutation = useAcknowledgeAlerta();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Alertas del sistema
          </CardTitle>
          <CardDescription>
            Detectadas automáticamente cada 5 min sobre `app_logs`. Se generan cuando una función produce ≥5 errores en una ventana de 5 minutos.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="alertas-include-ack" checked={includeAck} onCheckedChange={setIncludeAck} />
          <Label htmlFor="alertas-include-ack" className="text-xs">Incluir reconocidas</Label>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : alertas.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <BellOff className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin alertas {includeAck ? "registradas" : "activas"}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertas.map((a) => {
              const ack = !!a.acknowledged_at;
              return (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={severityVariant[a.severity] ?? "secondary"} className="uppercase text-[10px]">
                        {a.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{a.source}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </span>
                      {ack && <Badge variant="secondary" className="text-[10px]">Reconocida</Badge>}
                    </div>
                    <p className="text-sm font-medium break-words">{a.message}</p>
                    {a.payload && Object.keys(a.payload).length > 0 && (
                      <pre className="text-[11px] bg-muted rounded p-2 mt-2 overflow-auto max-h-32">
                        {JSON.stringify(a.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                  {!ack && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ackMutation.mutate(a.id)}
                      disabled={ackMutation.isPending}
                    >
                      <Check className="h-3 w-3 mr-1" /> Reconocer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
