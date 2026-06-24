/**
 * Editor de lista dinámica de contenedores. Reutilizable en wizard y vista detalle.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import {
  crearContenedorVacio,
  type ContenedorBorrador,
} from "@/features/embarques/types/contenedor";
import { FilaContenedor } from "./FilaContenedor";

const SOFT_CAP = 50;

interface Props {
  value: ContenedorBorrador[];
  onChange: (next: ContenedorBorrador[]) => void;
  disabled?: boolean;
  minRows?: number;
}

export function ListaContenedoresEditable({
  value,
  onChange,
  disabled,
  minRows = 1,
}: Props) {
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const [confirmSoftCap, setConfirmSoftCap] = useState(false);

  const appendRow = () => {
    const next = [...value, crearContenedorVacio(value.length + 1)];
    onChange(next);
  };

  const handleAgregar = () => {
    if (value.length >= SOFT_CAP) {
      setConfirmSoftCap(true);
      return;
    }
    appendRow();
  };

  const handleCambio = (
    index: number,
    cambios: Partial<ContenedorBorrador>,
  ) => {
    const next = value.map((row, i) => (i === index ? { ...row, ...cambios } : row));
    onChange(next);
  };

  const handleEliminar = (index: number) => {
    const next = value
      .filter((_, i) => i !== index)
      .map((row, i) => ({ ...row, orden: i + 1 }));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Sin contenedores. Agrega el primero para continuar.
        </div>
      ) : (
        value.map((row, idx) => (
          <FilaContenedor
            key={row.id ?? `nuevo-${idx}`}
            index={idx}
            value={row}
            tiposContenedor={tiposContenedor}
            canDelete={value.length > minRows}
            onChange={(cambios) => handleCambio(idx, cambios)}
            onDelete={() => handleEliminar(idx)}
            disabled={disabled}
          />
        ))
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAgregar}
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar contenedor
      </Button>

      <AlertDialog open={confirmSoftCap} onOpenChange={setConfirmSoftCap}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Agregar otro contenedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya tienes {value.length} contenedores en este embarque. Asegúrate de que sea correcto antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSoftCap(false);
                appendRow();
              }}
            >
              Sí, agregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
