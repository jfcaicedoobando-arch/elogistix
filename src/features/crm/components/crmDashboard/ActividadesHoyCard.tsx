import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Actividad {
  id: string;
  tipo: string;
  asunto: string;
  entidad_tipo: string;
  entidad_id: string;
  fecha_programada: string | null;
}

function entidadHref(tipo: string, id: string): string {
  if (tipo === "lead") return `/crm/leads/${id}`;
  if (tipo === "oportunidad") return `/crm/oportunidades/${id}`;
  if (tipo === "cliente") return `/clientes/${id}`;
  return "#";
}

function formatHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function ActividadesHoyCard({ items }: { items: Actividad[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Mis actividades de hoy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin actividades programadas hoy</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <Link to={entidadHref(a.entidad_tipo, a.entidad_id)} className="flex items-center gap-2 hover:underline">
                  <Badge variant="outline" className="text-2xs">{a.tipo}</Badge>
                  <span className="font-medium truncate max-w-[420px]">{a.asunto}</span>
                </Link>
                <span className="text-xs text-muted-foreground">{formatHora(a.fecha_programada)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
