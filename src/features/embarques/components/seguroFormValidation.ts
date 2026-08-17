/**
 * Bloque R — Validaciones del formulario de póliza de seguro.
 * B-056/EC-10: cada causa de bloqueo se comunica explícitamente vía toast.
 */
import { notifyError } from "@/lib/ui/appFeedback";
import type { SeguroEmbarqueInput } from "@/features/embarques/services/seguros";

type FormState = Omit<SeguroEmbarqueInput, "embarque_id">;

/** Devuelve `true` si el formulario es válido; en caso contrario notifica el error. */
export function validarSeguroForm(form: FormState, isEdit: boolean): boolean {
  if (!form.aseguradora.trim() || !form.numero_poliza.trim()) {
    notifyError(undefined, {
      title: "Faltan datos de la póliza",
      description: "Aseguradora y número de póliza son obligatorios.",
      method: "SEGURO_FORM_SUBMIT",
    });
    return false;
  }
  if (form.prima < 0) {
    notifyError(undefined, {
      title: "Prima inválida",
      description: "La prima no puede ser negativa.",
      method: "SEGURO_FORM_SUBMIT",
    });
    return false;
  }
  // EC-10: misma guarda para los otros dos campos monetarios del seguro.
  if (form.suma_asegurada < 0 || form.deducible < 0) {
    notifyError(undefined, {
      title: "Montos inválidos",
      description: "La suma asegurada y el deducible no pueden ser negativos.",
      method: "SEGURO_FORM_SUBMIT",
    });
    return false;
  }
  // En altas (donde la póliza es obligatoria) la suma asegurada debe ser > 0;
  // en edición se respetan registros históricos que pudieron quedar en 0.
  if (!isEdit && form.suma_asegurada <= 0) {
    notifyError(undefined, {
      title: "Suma asegurada requerida",
      description: "Captura una suma asegurada mayor a cero.",
      method: "SEGURO_FORM_SUBMIT",
    });
    return false;
  }
  if (form.vigencia_hasta < form.vigencia_desde) {
    notifyError(undefined, {
      title: "Vigencia inválida",
      description: "La vigencia final no puede ser anterior a la inicial.",
      method: "SEGURO_FORM_SUBMIT",
    });
    return false;
  }
  return true;
}
