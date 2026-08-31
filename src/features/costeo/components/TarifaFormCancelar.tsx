/**
 * "Cancelar" del footer de `TarifaForm`: usa el cierre guardado del
 * `FormDialogShell` para respetar la confirmación de descarte cuando hay
 * captura sin guardar (antes cerraba de golpe y se perdía lo capturado).
 */
import { Button } from "@/components/ui/button";
import { useFormDialogCerrar } from "@/components/shared/formDialogCloseContext";

interface Props {
  disabled: boolean;
  /** Fallback cuando el botón se usa fuera de un `FormDialogShell`. */
  onCerrarSinGuarda: () => void;
}

export function BotonCancelarTarifa({ disabled, onCerrarSinGuarda }: Props) {
  const cerrar = useFormDialogCerrar();
  return (
    <Button type="button" variant="outline" onClick={cerrar ?? onCerrarSinGuarda} disabled={disabled}>
      Cancelar
    </Button>
  );
}
