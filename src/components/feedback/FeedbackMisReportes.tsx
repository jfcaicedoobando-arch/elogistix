import { useQuery } from "@tanstack/react-query";
import { listarMisReportes } from "@/services/feedback";
import { ESTADO_FEEDBACK_LABEL, TIPO_FEEDBACK_LABEL, type EstadoReporteFeedback } from "@/types/feedback";
import { Badge } from "@/components/ui/badge";
import { Bug, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const ESTADO_VARIANT: Record<EstadoReporteFeedback, "default" | "secondary" | "outline" | "destructive"> = {
  nuevo: "default",
  en_revision: "secondary",
  resuelto: "outline",
  descartado: "destructive",
};

interface Props {
  usuarioId: string;
}

export function FeedbackMisReportes({ usuarioId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["mis-reportes-feedback", usuarioId],
    queryFn: () => listarMisReportes(usuarioId),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Cargando...</p>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Aún no has enviado reportes.</p>;
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {data.map((r) => (
        <div key={r.id} className="rounded-md border p-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {r.tipo === "bug" ? <Bug className="h-3.5 w-3.5 text-destructive shrink-0" /> : <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />}
              <span className="text-sm font-medium truncate">{r.titulo}</span>
            </div>
            <Badge variant={ESTADO_VARIANT[r.estado]} className="text-[10px] shrink-0">
              {ESTADO_FEEDBACK_LABEL[r.estado]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{r.descripcion}</p>
          <p className="text-[10px] text-muted-foreground">
            {TIPO_FEEDBACK_LABEL[r.tipo]} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
          </p>
        </div>
      ))}
    </div>
  );
}
