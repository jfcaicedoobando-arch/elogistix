/**
 * Payload y validación del formulario de Oportunidad (v13.629.1).
 * Extraído de `NuevaOportunidadDialog` para bajar la complejidad del handler.
 *
 * Fase 2 rediseño CRM: el ORIGEN (prospecto o cliente) es obligatorio y
 * excluyente — así el guard de base de datos nunca se ve forzado a rechazar.
 */
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

const opt = (v: number) => (v > 0 ? v : null);

/**
 * En EDICIÓN el origen es de sólo lectura: una oportunidad convertida desde
 * lead puede tener `lead_id` Y `cliente_id` (cliente del directorio). No se
 * debe borrar ese vínculo al guardar otros campos.
 */
function bloqueOrigen(form: OportunidadFormState, esEdicion: boolean) {
  if (form.origen_tipo === "prospecto") {
    return {
      lead_id: form.lead_id,
      cliente_id: esEdicion ? (form.cliente_id ?? null) : null,
      cliente_nombre: esEdicion ? (form.cliente_nombre ?? "") : "",
    };
  }
  return {
    lead_id: esEdicion ? (form.lead_id ?? null) : null,
    cliente_id: form.cliente_id,
    cliente_nombre: form.cliente_nombre,
  };
}

export function buildOportunidadFormPayload(
  form: OportunidadFormState,
  esGanada: boolean,
  esEdicion = false,
) {
  return {
    nombre: form.nombre,
    ...bloqueOrigen(form),
    etapa_id: form.etapa_id,
    monto_estimado: form.monto_estimado,
    moneda: form.moneda,
    probabilidad: form.probabilidad,
    fecha_estimada_cierre: form.fecha_estimada_cierre || null,
    // B-034: solo se persisten cuando la etapa destino es "ganada".
    ...(esGanada
      ? {
          fecha_cierre_real: form.fecha_cierre_real,
          valor_real: form.valor_real > 0 ? form.valor_real : form.monto_estimado,
        }
      : {}),
    modo: form.modo,
    origen: form.origen,
    destino: form.destino,
    notas: form.notas,
    vendedor_id: form.vendedor_id,
    vendedor_email: form.vendedor_email,
    monto_meta: opt(form.monto_meta),
    fecha_meta_cierre: form.fecha_meta_cierre || null,
    compromiso_nota: form.compromiso_nota || null,
    margen_pct: opt(form.margen_pct),
    riesgos_objeciones: form.riesgos_objeciones || null,
  };
}

/** Devuelve el mensaje de validación o `null` si el formulario es válido. */
export function validarOportunidadForm(
  form: OportunidadFormState,
  esGanada: boolean,
): { title: string; description?: string } | null {
  if (!form.nombre.trim()) return { title: "Nombre es obligatorio" };
  if (form.origen_tipo === "prospecto" && !form.lead_id) {
    return {
      title: "Selecciona el prospecto de origen",
      description:
        "Toda oportunidad nace de un prospecto calificado o de un cliente del directorio.",
    };
  }
  if (form.origen_tipo === "cliente" && !form.cliente_id) {
    return {
      title: "Selecciona el cliente de origen",
      description:
        "Toda oportunidad nace de un prospecto calificado o de un cliente del directorio.",
    };
  }
  if (!form.etapa_id) return { title: "Selecciona una etapa" };
  if (esGanada && !form.fecha_cierre_real) {
    return {
      title: "Captura la fecha de cierre real",
      description:
        "Una oportunidad ganada necesita su fecha de cierre para que el Resumen y el Leaderboard coincidan.",
    };
  }
  return null;
}
