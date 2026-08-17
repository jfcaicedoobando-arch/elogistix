/**
 * Payload y validación del formulario de Oportunidad (v13.629.1).
 * Extraído de `NuevaOportunidadDialog` para bajar la complejidad del handler.
 */
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

const opt = (v: number) => (v > 0 ? v : null);

export function buildOportunidadFormPayload(form: OportunidadFormState, esGanada: boolean) {
  return {
    nombre: form.nombre,
    cliente_id: form.cliente_id,
    cliente_nombre: form.cliente_nombre,
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
