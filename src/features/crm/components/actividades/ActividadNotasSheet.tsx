/**
 * ActividadNotasSheet — Sheet ligero para editar el campo `resultado` (notas)
 * de una actividad sin abrir el diálogo completo.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useActualizarActividadNotas } from "@/features/crm/hooks";
import type { CrmActividadRow } from "@/features/crm/hooks";
import { crmToast } from "@/features/crm/lib/crmToast";
import { formSheet } from "@/components/shared/utils/dialogTokens";

interface Props {
  actividad: CrmActividadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ActividadNotasSheet({ actividad, open, onOpenChange }: Props) {
  const [resultado, setResultado] = useState("");
  const mutate = useActualizarActividadNotas();

  useEffect(() => {
    if (open && actividad) setResultado(actividad.resultado ?? "");
  }, [open, actividad]);

  const handleGuardar = async () => {
    if (!actividad) return;
    try {
      await mutate.mutateAsync({ id: actividad.id, resultado });
      crmToast.success("Notas guardadas");
      onOpenChange(false);
    } catch {
      // useActualizarActividadNotas ya notifica el error en onError.
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={formSheet}>
        <SheetHeader>
          <SheetTitle>Notas de actividad</SheetTitle>
          <SheetDescription className="line-clamp-1">
            {actividad?.asunto ?? ""}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="resultado">Resultado / notas</Label>
          <Textarea
            id="resultado"
            rows={10}
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="¿Qué pasó? ¿Próximos pasos?"
          />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={mutate.isPending}>
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
