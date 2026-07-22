/**
 * Diálogos de confirmación destructivos usados por `<AdjuntoRow />`
 * (reemplazar / quitar adjunto CFDI). Extraídos para respetar el límite
 * de 200 líneas por archivo (Power of 10).
 */
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TipoAdjuntoCfdi } from "@/features/cxp/services";

export function ConfirmReplaceDialog({
  file, tipo, onCancel, onConfirm,
}: {
  file: File | null;
  tipo: TipoAdjuntoCfdi;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  return (
    <AlertDialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reemplazar el {tipo} actual?</AlertDialogTitle>
          <AlertDialogDescription>
            El archivo existente se sobreescribirá con
            <span className="font-medium"> {file?.name}</span>. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (file) onConfirm(file); }}>
            Reemplazar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConfirmRemoveDialog({
  open, tipo, onOpenChange, onConfirm,
}: {
  open: boolean;
  tipo: TipoAdjuntoCfdi;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quitar el {tipo} adjunto?</AlertDialogTitle>
          <AlertDialogDescription>
            La factura permanecerá, pero ya no tendrá el archivo {tipo}. Podrás adjuntar uno nuevo después.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Quitar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
