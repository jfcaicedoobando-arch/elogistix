/**
 * CRM-COT-01 — precarga del destinatario cuando se llega al wizard desde una
 * oportunidad de prospecto (`/cotizaciones/nueva?oportunidad=<id>`).
 *
 * No inserta nada: sólo rellena el paso 1 con el mismo vínculo que produce el
 * buscador de prospectos (oportunidad + lead + datos reales del destinatario +
 * moneda del CRM, sin convertir importes). Si ya hay un borrador vivo o el
 * usuario capturó algo, NO se pisa nada.
 */
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types/form";
import { useCrmProspectoOportunidad } from "@/features/crm/hooks/useCrmProspectoOportunidad";
import { mapModoCrmACotizacion } from "@/features/crm/domain/modoCotizacion";
import { INCOTERMS } from "@/constants/wizardConstants";
import { FRECUENCIAS_COTIZACION } from "@/features/cotizacion/domain/frecuencias";

interface Deps {
  form: UseFormReturn<CotizacionFormValues>;
  oportunidadId: string | null;
  /** Falso mientras haya borrador pendiente/restauración o cotización creada. */
  enabled: boolean;
}

/**
 * Campos que la precarga escribe. Si el usuario ya tocó cualquiera de ellos
 * (respuesta lenta del CRM), se abandona la precarga completa para no mezclar
 * en silencio datos de la oportunidad con una captura distinta.
 */
const CAMPOS_PRECARGA = [
  "clienteId",
  "esProspecto",
  "oportunidadId",
  "leadId",
  "prospectoEmpresa",
  "prospectoContacto",
  "prospectoEmail",
  "prospectoTelefono",
  "monedaCrm",
  "modo",
  "origen",
  "destino",
  "incoterm",
  "frecuencia",
] as const;

/**
 * CRM-P2.6: el perfil ICP del lead (incoterm y frecuencia) ya estaba capturado
 * en el CRM pero no llegaba al cotizador. Se precarga SÓLO si el valor existe y
 * es compatible con el catálogo del cotizador: nunca se inventa ni se traduce
 * (el ICP admite frecuencias que el cotizador no tiene, p. ej. "Trimestral").
 */
function aplicarIcp(
  form: UseFormReturn<CotizacionFormValues>,
  match: { icpIncoterm?: string | null; icpFrecuencia?: string | null },
): void {
  const incoterm = (match.icpIncoterm ?? "").trim().toUpperCase();
  const incotermValido = INCOTERMS.find((i) => i === incoterm);
  if (incotermValido) {
    form.setValue("incoterm", incotermValido, { shouldDirty: true, shouldValidate: true });
  }
  const frecuencia = (match.icpFrecuencia ?? "").trim().toLowerCase();
  const frecuenciaValida = FRECUENCIAS_COTIZACION.find((f) => f.toLowerCase() === frecuencia);
  if (frecuenciaValida) form.setValue("frecuencia", frecuenciaValida, { shouldDirty: true });
}

export function usePrefillProspectoOportunidad({ form, oportunidadId, enabled }: Deps) {
  const aplicado = useRef(false);
  const { data: match } = useCrmProspectoOportunidad(oportunidadId, enabled);
  // Suscripción explícita al estado sucio: garantiza re-render (y por tanto
  // reevaluación) cuando el usuario captura algo mientras el CRM responde.
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!enabled || aplicado.current || !match) return;
    // Nunca reemplazamos un vínculo o captura ya hecha por el usuario. Se
    // consulta el estado vivo del formulario en el momento de aplicar.
    const v = form.getValues();
    const tocado = CAMPOS_PRECARGA.some((c) => form.getFieldState(c).isDirty);
    if (tocado || v.oportunidadId || v.leadId || v.clienteId) {
      aplicado.current = true;
      return;
    }

    const opts = { shouldDirty: true, shouldValidate: true } as const;
    form.setValue("esProspecto", true, opts);
    form.setValue("oportunidadId", match.id, opts);
    form.setValue("leadId", match.leadId ?? "", { shouldDirty: true });
    form.setValue("prospectoEmpresa", match.empresa, { shouldDirty: true });
    form.setValue("prospectoContacto", match.contacto, { shouldDirty: true });
    form.setValue("prospectoEmail", match.email, { shouldDirty: true });
    form.setValue("prospectoTelefono", match.telefono, { shouldDirty: true });
    const moneda = match.moneda === "USD" || match.moneda === "MXN" ? match.moneda : "";
    // La moneda del vínculo viaja en `monedaCrm` (el guardado la usa tal cual,
    // sin convertir importes).
    form.setValue("monedaCrm", moneda, { shouldDirty: true });
    // Modo y ruta: sólo si el CRM los tiene. El modo pasa por el mapeo canónico
    // (el CRM puede guardar valores que no son modos, p. ej. "FCL"); si no hay
    // equivalencia se deja el default del formulario en vez de inventar uno.
    const modo = mapModoCrmACotizacion(match.modo);
    if (modo) form.setValue("modo", modo, opts);
    if (match.origen) form.setValue("origen", match.origen, { shouldDirty: true });
    if (match.destino) form.setValue("destino", match.destino, { shouldDirty: true });
    aplicarIcp(form, match);
    form.trigger(["oportunidadId", "prospectoEmpresa"]);
    aplicado.current = true;
  }, [enabled, match, form, isDirty]);
}

