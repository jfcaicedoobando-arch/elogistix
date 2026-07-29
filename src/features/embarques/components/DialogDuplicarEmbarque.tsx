/**
 * Diálogo para duplicar un embarque desde la página de detalle.
 *
 * v12.1.0: lógica de estado/validación movida a `useDuplicarEmbarqueDialog`
 * y la fila por copia a `CopiaContenedorRow` para cumplir Power of 10.
 */
import { Loader2, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { CopiaContenedorRow } from "./duplicarEmbarque/CopiaContenedorRow";
import { useDuplicarEmbarqueDialog } from "@/features/embarques/hooks/useDuplicarEmbarqueDialog";
import { MAX_COPIAS } from "./duplicarEmbarque/types";
import type { EmbarqueRow } from "@/features/embarques/hooks";

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DialogDuplicarEmbarque({ embarque, open, onOpenChange }: Props) {
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const {
    copias, isPending,
    handleAgregar, handleQuitar, updateCampo, handleConfirmar,
  } = useDuplicarEmbarqueDialog({ embarque, open, onOpenChange });

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Copy}
      title={`Duplicar embarque ${embarque.expediente}`}
      description="Se crearán nuevos embarques con los mismos datos (cliente, ruta, contenedores hijos, conceptos de venta/costo, documentos). Los conceptos asignados a un contenedor específico mantienen su asignación al contenedor copiado."
      size="3xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Duplicar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {copias.map((copia, idx) => (
          <CopiaContenedorRow
            key={idx}
            idx={idx}
            copia={copia}
            tiposContenedor={tiposContenedor}
            canRemove={copias.length > 1}
            onChange={(campo, value) => updateCampo(idx, campo, value)}
            onRemove={() => handleQuitar(idx)}
          />
        ))}
      </div>

      <Button
        type="button" variant="outline" size="sm"
        onClick={handleAgregar}
        disabled={copias.length >= MAX_COPIAS}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar copia ({copias.length}/{MAX_COPIAS})
      </Button>
    </FormDialogShell>
  );
}
