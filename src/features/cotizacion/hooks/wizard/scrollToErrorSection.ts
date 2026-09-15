/**
 * Mapea un mensaje de error de `validatePaso1` a la sección visible del wizard
 * para permitir scroll+focus automático (P0 — v13.293.0 "errores navegables").
 *
 * Los ids provienen de `PasoDatosGenerales.tsx` (`seccion-cliente`, etc.).
 */
const REGLAS_SECCION: Array<[readonly string[], string]> = [
  // Q1 (v13.823.396): el tipo de contenedor vive en la sección Mercancía y se
  // evalúa antes que las reglas de "tipo de operación"/"tarifa".
  [["tipo de contenedor"], "seccion-mercancia"],
  [["modo de transporte", "tipo de operación", "incoterm"], "seccion-operacion"],
  [["descripción de la mercancía"], "seccion-mercancia"],
  [["origen", "destino"], "seccion-ruta"],
  [["cliente", "prospecto", "lead", "oportunidad", "empresa", "contacto"], "seccion-cliente"],
  [["modalidad", "equipo", "punto de carga"], "seccion-operacion"],
  [["tarifa"], "seccion-tarifa"],
  [["número de contenedores"], "seccion-cierre"],
];

export function seccionParaErrorPaso1(mensaje: string): string {
  const m = mensaje.toLowerCase();
  const match = REGLAS_SECCION.find(([patrones]) => patrones.some((p) => m.includes(p)));
  return match?.[1] ?? "seccion-cliente";
}


/**
 * Hace scroll suave al primer elemento con `id` y aplica focus al primer
 * input/select/textarea dentro de la sección para acelerar la corrección.
 * Sin-op en SSR o si el elemento no existe.
 */
export function scrollAndFocusSection(sectionId: string): void {
  if (typeof document === "undefined") return;
  try {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus al primer control interactivo (setTimeout para dar espacio al scroll).
    setTimeout(() => {
      try {
        const focusable = el.querySelector<HTMLElement>(
          "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='combobox']:not([disabled])",
        );
        focusable?.focus();
        // Efecto visual sutil: pulse durante 1.5s.
        el.classList.add("ring-2", "ring-primary/60", "rounded-md", "transition");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 1500);
      } catch {
        // JSDOM u orígenes hostiles con querySelector limitado.
      }
    }, 320);
  } catch {
    // sectionId malformado (SSR + strings del usuario).
  }
}

/**
 * T-12 (auditoría v13.627.1): además del scroll a la sección, marcamos el
 * campo concreto con `setError` para que el error se vea inline y no sólo en
 * un toast que desaparece. Devuelve el nombre del campo RHF correspondiente
 * al mensaje de `validatePaso1`, o `null` si el error no mapea a un campo.
 */
export type CampoErrorPaso1 =
  | "clienteId"
  | "oportunidadId"
  | "prospectoEmpresa"
  | "prospectoContacto"
  | "modalidadEquipo"
  | "puntoIntermedio"
  | "tarifaId"
  | "modo"
  | "tipo"
  | "incoterm"
  | "descripcionMercancia"
  | "origen"
  | "destino"
  | "numContenedores"
  | "tipoContenedor";

/**
 * Tabla declarativa de reglas (patrón → campo). Mismo criterio y orden que
 * `REGLAS_SECCION`: "tipo de contenedor" se evalúa antes que "tipo de
 * operación" para no capturar el mensaje ajeno.
 */
const REGLAS_CAMPO: Array<[readonly string[], CampoErrorPaso1]> = [
  [["tipo de contenedor"], "tipoContenedor"],
  [["número de contenedores"], "numContenedores"],
  [["modo de transporte"], "modo"],
  [["tipo de operación"], "tipo"],
  [["incoterm"], "incoterm"],
  [["descripción de la mercancía"], "descripcionMercancia"],
  [["origen de la ruta"], "origen"],
  [["destino de la ruta"], "destino"],
  [["lead", "oportunidad"], "oportunidadId"],
  [["empresa del prospecto"], "prospectoEmpresa"],
  [["contacto del prospecto"], "prospectoContacto"],
  [["selecciona un cliente"], "clienteId"],
  [["modalidad de equipo"], "modalidadEquipo"],
  [["punto de carga"], "puntoIntermedio"],
  [["tarifa"], "tarifaId"],
];

export function campoParaErrorPaso1(mensaje: string): CampoErrorPaso1 | null {
  const m = mensaje.toLowerCase();
  const match = REGLAS_CAMPO.find(([patrones]) => patrones.some((p) => m.includes(p)));
  return match?.[1] ?? null;
}

