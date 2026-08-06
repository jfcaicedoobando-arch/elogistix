import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, Mail } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { EnvioRow } from "@/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail";

interface Props {
  envios: EnvioRow[];
}

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  enviado: "default",
  parcial: "secondary",
  fallido: "destructive",
};

export function HistorialEnviosCard({ envios }: Props) {
  if (envios.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4" /> Historial de envíos por correo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {envios.map((e) => {
          const tos = (e.destinatarios ?? []).map((d) => d.email).join(", ");
          const ccs = (e.cc ?? []).join(", ");
          return (
            <div key={e.id} className="border rounded-md p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(e.created_at, "dd/MM/yyyy HH:mm")}
                </span>
                <Badge variant={ESTADO_VARIANT[e.estado] ?? "outline"}>{e.estado}</Badge>
              </div>
              <p>
                <span className="text-muted-foreground">Para:</span> {tos || "—"}
              </p>
              {ccs && (
                <p>
                  <span className="text-muted-foreground">CC:</span> {ccs}
                </p>
              )}
              {e.asunto && <p className="text-xs text-muted-foreground truncate">{e.asunto}</p>}
              {e.error && <p className="text-xs text-destructive truncate">{e.error}</p>}
              {e.pdf_link_publico && (
                <Button variant="outline" size="sm" asChild>
                  <a href={e.pdf_link_publico} target="_blank" rel="noreferrer">
                    <FileDown className="h-3 w-3 mr-1" /> Ver PDF enviado
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
