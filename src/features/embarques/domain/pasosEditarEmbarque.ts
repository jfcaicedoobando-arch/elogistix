/**
 * Pasos del wizard de edición de embarque (lógica pura, sin React).
 *
 * B1 (v13.823.395): el paso 3 «Costos y Pricing» edita costos y pricing. Los
 * roles operativos que sólo LEEN costos (coordinador logístico, gerente de
 * operaciones) no deben poder seleccionarlo ni llegar por `?step=3`.
 */
export interface PasoEditarEmbarque {
  title: string;
  num: number;
}

const STEPS_BASE: readonly PasoEditarEmbarque[] = [
  { title: "Datos Generales", num: 1 },
  { title: "Datos de Ruta", num: 2 },
];

const STEP_COSTOS: PasoEditarEmbarque = { title: "Costos y Pricing", num: 3 };

/** Pasos visibles según la capacidad estrecha de editar costos. */
export function pasosEditarEmbarque(canEditCostos: boolean): PasoEditarEmbarque[] {
  return canEditCostos ? [...STEPS_BASE, STEP_COSTOS] : [...STEPS_BASE];
}

/** Subtítulo del wizard: sólo menciona costos si el rol puede editarlos. */
export function subtituloEditarEmbarque(canEditCostos: boolean): string {
  return canEditCostos
    ? "Modifica los datos generales, ruta y costos del embarque"
    : "Modifica los datos generales y la ruta del embarque";
}

/** Un embarque cerrado bloquea toda escritura en base de datos. */
export function embarqueEstaCerrado(estado: string | null | undefined): boolean {
  return (estado ?? "").toLowerCase() === "cerrado";
}

/**
 * Paso al que se debe ir dado el `?step=` de la URL.
 *
 * Devuelve `null` cuando el parámetro no es un paso válido (no se toca el paso
 * actual) y 1 cuando el paso pedido existe pero está fuera del alcance del rol.
 */
export function resolverPasoEditarEmbarque(
  raw: string | null,
  totalSteps: number,
): number | null {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1) return null;
  return n <= totalSteps ? n : 1;
}
