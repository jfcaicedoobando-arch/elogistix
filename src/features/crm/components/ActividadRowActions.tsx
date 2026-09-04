/**
 * Acciones inline para una fila de actividad: Completar, Posponer y Notas.
 * Las notas siguen disponibles incluso en actividades completadas.
 */
import { useState } from "react";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCompletarActividad, usePosponerActividad, type CrmActividadRow,
} from "@/features/crm/hooks";
import ActividadNotasSheet from "@/features/crm/components/actividades/ActividadNotasSheet";

interface Props { actividad: CrmActividadRow }

export default function ActividadRowActions({ actividad }: Props) {
  const completar = useCompletarActividad();
  const posponer = usePosponerActividad();
  const [notasOpen, setNotasOpen] = useState(false);
  const completada = !!actividad.fecha_completada;

  const handleCompletar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // El hook `useCompletarActividad` ya notifica éxito y error: un solo aviso.
    try {
      await completar.mutateAsync({ id: actividad.id });
    } catch {
      /* notificado por el hook */
    }
  };

  const handlePosponer = async (dias: number, label: string) => {
    // El hook `usePosponerActividad` ya notifica éxito y error: un solo aviso.
    try {
      await posponer.mutateAsync({ id: actividad.id, dias, fechaProgramada: actividad.fecha_programada });
    } catch {
      /* notificado por el hook */
    }
  };

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {!completada && (
          <>
            <Hint label="Marcar como completada">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={handleCompletar}
                disabled={completar.isPending}
                loading={completar.isPending}
                aria-label="Marcar como completada"
              >
                {!completar.isPending && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              </Button>
            </Hint>
            <DropdownMenu>
              <Hint label="Posponer">
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2" disabled={posponer.isPending} loading={posponer.isPending} aria-label="Posponer">
                    {!posponer.isPending && <Clock className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
              </Hint>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => handlePosponer(1, "1 día")}>+1 día</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePosponer(3, "3 días")}>+3 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePosponer(7, "1 semana")}>+1 semana</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <Hint label="Notas / resultado">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setNotasOpen(true)}
            aria-label="Notas / resultado"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </Hint>
      </div>
      <ActividadNotasSheet
        actividad={actividad}
        open={notasOpen}
        onOpenChange={setNotasOpen}
      />
    </>
  );
}
