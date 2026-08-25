/**
 * Mapea un mensaje de error de `validatePaso1` a la sección visible del wizard
 * para permitir scroll+focus automático (P0 — v13.293.0 "errores navegables").
 *
 * Los ids provienen de `PasoDatosGenerales.tsx` (`seccion-cliente`, etc.).
 */
export function seccionParaErrorPaso1(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("modo de transporte") || m.includes("tipo de operación") || m.includes("incoterm")) {
    return "seccion-operacion";
  }
  if (m.includes("descripción de la mercancía")) {
    return "seccion-mercancia";
  }
  if (m.includes("origen") || m.includes("destino")) {
    return "seccion-ruta";
  }
  if (m.includes("cliente") || m.includes("prospecto") || m.includes("lead") || m.includes("oportunidad") || m.includes("empresa") || m.includes("contacto")) {
    return "seccion-cliente";
  }
  if (m.includes("modalidad") || m.includes("equipo") || m.includes("punto de carga")) {
    return "seccion-operacion";
  }
  if (m.includes("tarifa")) {
    return "seccion-tarifa";
  }
  return "seccion-cliente";
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
  | "tarifaId";

export function campoParaErrorPaso1(mensaje: string): CampoErrorPaso1 | null {
  const m = mensaje.toLowerCase();
  if (m.includes("lead") || m.includes("oportunidad")) return "oportunidadId";
  if (m.includes("empresa del prospecto")) return "prospectoEmpresa";
  if (m.includes("contacto del prospecto")) return "prospectoContacto";
  if (m.includes("selecciona un cliente")) return "clienteId";
  if (m.includes("modalidad de equipo")) return "modalidadEquipo";
  if (m.includes("punto de carga")) return "puntoIntermedio";
  if (m.includes("tarifa")) return "tarifaId";
  return null;
}
