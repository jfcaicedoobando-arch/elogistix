import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Vencida {
  id: string;
  asunto: string;
  fecha_programada: string | null;
}

interface Props {
  vencidas: Vencida[];
}

export function VencidasAlert({ vencidas }: Props) {
  if (vencidas.length === 0) return null;
  const count = vencidas.length === 5 ? "5+" : String(vencidas.length);
  const plural = vencidas.length === 1 ? "" : "es";
  const fecha = vencidas[0].fecha_programada
    ? new Date(vencidas[0].fecha_programada).toLocaleDateString("es-MX")
    : "—";
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium">
              Tienes {count} actividad{plural} vencida{plural}
            </p>
            <p className="text-xs text-muted-foreground">
              Próxima: {vencidas[0].asunto} · {fecha}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="destructive">
          <Link to="/crm/actividades?filtro=vencidas">Ver vencidas</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
