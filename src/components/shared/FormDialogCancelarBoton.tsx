/**
 * Botón "Cancelar" canónico para footers de `FormDialogShell` (v13.821.7).
 *
 * Reutiliza el cierre guardado del shell (`useFormDialogCerrar`) para que
 * Cancelar respete la misma confirmación de descarte que X/Escape/clic
 * exterior cuando hay `isDirty`. Fuera de un `FormDialogShell` (tests,
 * usos sueltos) cae al `onCancelar` recibido.
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useFormDialogCerrar } from "@/components/shared/formDialogCloseContext";

interface Props {
  onCancelar: () => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function FormDialogCancelarBoton({ onCancelar, disabled, children = "Cancelar" }: Props) {
  const cerrarGuardado = useFormDialogCerrar();
  return (
    <Button type="button" variant="outline" onClick={cerrarGuardado ?? onCancelar} disabled={disabled}>
      {children}
    </Button>
  );
}
