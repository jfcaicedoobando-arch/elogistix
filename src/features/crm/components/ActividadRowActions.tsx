/**
 * Acciones inline para una fila de actividad: Completar, Posponer y Notas.
 * Las notas siguen disponibles incluso en actividades completadas.
 */
import { useState } from "react";
import { CheckCircle2, Clock, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCompletarActividad, usePosponerActividad, type CrmActividadRow,
} from "@/features/crm/hooks";
import { crmToast } from "@/features/crm/lib/crmToast";
import ActividadNotasSheet from "@/features/crm/components/actividades/ActividadNotasSheet";

interface Props { actividad: CrmActividadRow }

export default function ActividadRowActions({ actividad }: Props) {
  const completar = useCompletarActividad();
  const posponer = usePosponerActividad();
  const [notasOpen, setNotasOpen] = useState(false);
  const completada = !!actividad.fecha_completada;

  const handleCompletar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await completar.mutateAsync({ id: actividad.id });
      crmToast.success("Actividad completada");
    } catch (err) {
      crmToast.error("No se pudo completar", err);
    }
  };

  const handlePosponer = async (dias: number, label: string) => {
    try {
      await posponer.mutateAsync({ id: actividad.id, dias, fechaProgramada: actividad.fecha_programada });
      crmToast.success(`Pospuesto ${label}`);
    } catch (err) {
      crmToast.error("No se pudo posponer", err);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {!completada && (
          <>
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
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => setNotasOpen(true)}
          title="Notas / resultado"
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ActividadNotasSheet
        actividad={actividad}
        open={notasOpen}
        onOpenChange={setNotasOpen}
      />
    </>
  );
}
