/**
 * Subcomponente presentacional: historial de cierres/reaperturas.
 * Extraído de `TabCierre.tsx` (Auditoría arquitectónica 13.56.6 / paso 15).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

export interface CierreLogEntry {
  id: string;
  accion: string;
  created_at: string;
  motivo?: string | null;
}

export function CierreHistorialCard({ log }: { log: CierreLogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
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
                <div className="flex items-center justify-between">
                  <Badge variant={entry.accion === "cerrar" ? "default" : "outline"}>
                    {entry.accion === "cerrar" ? "Cerrado" : "Reabierto"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("es-MX")}
                  </span>
                </div>
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
