/**
 * Subcomponente presentacional: historial de cierres/reaperturas.
 * Extraído de `TabCierre.tsx` (Auditoría arquitectónica 13.56.6 / paso 15).
 *
 * v13.139.x — muestra el usuario que ejecutó la acción y soporta
 * registros legacy provenientes de `bitacora_actividad` (cuando el cierre
 * se realizó antes de que existiera `cierre_embarque_log`).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { formatFechaHora } from "@/lib/formatters";

export interface CierreLogEntry {
  id: string;
  accion: string;
  created_at: string;
  motivo?: string | null;
  usuario_email?: string | null;
  origen?: "log" | "bitacora";
}

export function CierreHistorialCard({ log }: { log: CierreLogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Historial de cierres
        </CardTitle>
      </CardHeader>
      <CardContent>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="space-y-2">
            {log.map((entry) => (
              <li key={entry.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={entry.accion === "cerrar" ? "default" : "outline"}>
                      {entry.accion === "cerrar" ? "Cerrado" : "Reabierto"}
                    </Badge>
                    {entry.origen === "bitacora" && (
                      <Badge variant="secondary" className="text-2xs">
                        Registro legacy
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatFechaHora(entry.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Por <span className="font-medium text-foreground">
                    {entry.usuario_email ?? "Usuario desconocido"}
                  </span>
                </p>
                {entry.motivo && (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.motivo}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
