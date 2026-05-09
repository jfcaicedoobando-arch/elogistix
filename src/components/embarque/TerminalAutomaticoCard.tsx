import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Satellite,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/formatters";
import {
  useTrackingTerminal49,
  useActivarTracking,
  useSincronizarTracking,
  useEliminarTracking,
} from "@/hooks/embarque/useTrackingTerminal49";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  embarqueId: string;
  modo: string | null;
  blMaster: string | null;
  naviera: string | null;
}

const STATUS_LABEL: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    hint: string;
  }
> = {
  pending: {
    label: "Pendiente",
    variant: "secondary",
    hint: "En cola en Terminal49 — aún no se envía a la naviera.",
  },
  created: {
    label: "Esperando naviera",
    variant: "secondary",
    hint: "Terminal49 ya consultó a la naviera. Esperando respuesta (puede tardar de minutos a 24-48 h).",
  },
  awaiting_manifest: {
    label: "Esperando manifiesto",
    variant: "secondary",
    hint: "La naviera aún no publica el manifiesto del BL. Reintentamos automáticamente.",
  },
  tracking: {
    label: "Rastreando",
    variant: "default",
    hint: "La naviera respondió y estamos recibiendo eventos.",
  },
  succeeded: {
    label: "Activo",
    variant: "default",
    hint: "Tracking confirmado por la naviera.",
  },
  failed: {
    label: "Falló",
    variant: "destructive",
    hint: "Terminal49 no pudo rastrear este BL. Revisa el motivo.",
  },
  inactive: { label: "Inactivo", variant: "outline", hint: "" },
};

export function TerminalAutomaticoCard({ embarqueId, modo, blMaster, naviera }: Props) {
  const { canEdit } = usePermissions();
  const { data: tracking, isLoading } = useTrackingTerminal49(embarqueId);
  const activar = useActivarTracking(embarqueId);
  const sincronizar = useSincronizarTracking(embarqueId);
  const eliminar = useEliminarTracking(embarqueId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (modo !== "Marítimo") return null;

  const puedeActivar = !!blMaster && !!naviera;
  const status = tracking?.status ?? "";
  const statusBadge = STATUS_LABEL[status] ?? { label: status || "—", variant: "outline" as const };

  return (
    <Card className="border-accent/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Satellite className="h-4 w-4 text-accent" />
          Tracking automático (Terminal49)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !tracking ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sincroniza automáticamente ETA, milestones y eventos del contenedor desde la naviera vía Terminal49.
            </p>
            {!puedeActivar && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 p-2 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Captura el <strong>BL Master</strong> y la <strong>naviera</strong> antes de activar el tracking.
                </span>
              </div>
            )}
            {canEdit && (
              <Button
                size="sm"
                onClick={() => activar.mutate(undefined)}
                disabled={!puedeActivar || activar.isPending}
              >
                <Satellite className="h-4 w-4 mr-1" />
                {activar.isPending ? "Activando…" : "Activar tracking automático"}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {tracking.request_type === "bill_of_lading" ? "BL" : tracking.request_type === "container" ? "Contenedor" : "Booking"}:{" "}
                <span className="font-mono">{tracking.request_number}</span>
              </span>
              <span className="text-xs text-muted-foreground">SCAC: {tracking.scac}</span>
            </div>

            {tracking.failed_reason && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{tracking.failed_reason}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Última sincronización:</span>{" "}
                {tracking.last_synced_at ? formatDate(tracking.last_synced_at, "dd MMM yyyy HH:mm") : "—"}
              </div>
              <div>
                <span className="font-medium text-foreground">Último evento:</span>{" "}
                {tracking.last_event_at ? formatDate(tracking.last_event_at, "dd MMM yyyy HH:mm") : "—"}
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sincronizar.mutate()}
                  disabled={sincronizar.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${sincronizar.isPending ? "animate-spin" : ""}`} />
                  {sincronizar.isPending ? "Sincronizando…" : "Sincronizar ahora"}
                </Button>

                <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Desactivar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Desactivar el tracking automático?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará el vínculo con Terminal49 para este embarque. Los eventos ya
                        registrados se conservan. Podrás reactivarlo cuando quieras.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          eliminar.mutate();
                          setConfirmDelete(false);
                        }}
                      >
                        Sí, desactivar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {status === "succeeded" && !tracking.failed_reason && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tracking confirmado por la naviera
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
