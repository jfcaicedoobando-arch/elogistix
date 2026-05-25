/**
 * Acciones inline para una fila de actividad: Completar y Posponer.
 */
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import {
  useCompletarActividad, usePosponerActividad, type CrmActividadRow,
} from "@/hooks/crm/useActividades";

interface Props { actividad: CrmActividadRow }

export default function ActividadRowActions({ actividad }: Props) {
  const { toast } = useToast();
  const completar = useCompletarActividad();
  const posponer = usePosponerActividad();
  const completada = !!actividad.fecha_completada;

  const handleCompletar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await completar.mutateAsync({ id: actividad.id });
      notifySuccess(toast, { title: "Actividad completada" });
    } catch (err) {
      notifyError(toast, { title: "No se pudo completar", description: err instanceof Error ? err.message : undefined });
    }
  };

  const handlePosponer = async (dias: number, label: string) => {
    try {
      await posponer.mutateAsync({ id: actividad.id, dias, fechaProgramada: actividad.fecha_programada });
      notifySuccess(toast, { title: `Pospuesto ${label}` });
    } catch (err) {
      notifyError(toast, { title: "No se pudo posponer", description: err instanceof Error ? err.message : undefined });
    }
  };

  if (completada) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={handleCompletar}
        disabled={completar.isPending}
        title="Marcar como completada"
      >
        {completar.isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={posponer.isPending} title="Posponer">
            {posponer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => handlePosponer(1, "1 día")}>+1 día</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePosponer(3, "3 días")}>+3 días</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePosponer(7, "1 semana")}>+1 semana</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
