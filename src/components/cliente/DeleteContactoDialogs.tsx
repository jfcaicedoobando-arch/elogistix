import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  step: 0 | 1 | 2;
  onConfirmFirst: () => void;
  onConfirmFinal: () => void;
  onCancel: () => void;
}

export default function DeleteContactoDialogs({ step, onConfirmFirst, onConfirmFinal, onCancel }: Props) {
  return (
    <>
      <AlertDialog open={step === 1} onOpenChange={open => !open && onCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar este contacto del cliente. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmFirst}>Sí, continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={step === 2} onOpenChange={open => !open && onCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmación final</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción <strong>no se puede deshacer</strong>. El contacto será eliminado permanentemente. ¿Confirmas la eliminación?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmFinal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
