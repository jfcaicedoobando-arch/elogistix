import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numContenedores: number;
  isPending: boolean;
  onConfirmar: () => void;
}

export function DialogGenerarEmbarques({ open, onOpenChange, numContenedores, isPending, onConfirmar }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Generar embarques?</AlertDialogTitle>
          <AlertDialogDescription>
            Se crearán {numContenedores} embarque{numContenedores > 1 ? 's' : ''} desde esta cotización.
            Los conceptos por Contenedor se copiarán a cada embarque.
            Los conceptos por BL solo al primer embarque.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirmar}>
            {isPending ? 'Generando…' : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
