/**
 * Salida del wizard de cotización (botón "Cancelar" del paso 1 y "Anterior").
 *
 * En el paso 1 el botón "Cancelar" navegaba directo al listado y se perdía todo
 * lo capturado sin aviso. Ahora la salida del paso 1 pasa por la guarda de
 * cambios (`useDirtyGuard.confirmarSalida`); retroceder entre pasos no pierde
 * nada, así que sigue siendo inmediato.
 */
interface Args {
  currentStep: number;
  isBusy: boolean;
  /** `handleBack` del wizard: paso >1 retrocede, paso 1 navega al listado. */
  retroceder: () => void;
  /** `confirmarSalida` de `useDirtyGuard`. */
  confirmarSalida: (accion: () => void) => void;
}

export function ejecutarSalidaWizard({ currentStep, isBusy, retroceder, confirmarSalida }: Args): void {
  if (isBusy) return;
  if (currentStep === 1) {
    confirmarSalida(retroceder);
    return;
  }
  retroceder();
}
