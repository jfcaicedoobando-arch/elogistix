/** Texto legible de reglas de puntaje y armado de una regla desde el formulario. */
import { aNumero } from "@/features/crm/services/pricing/tiposPricing";
import { ETIQUETA_FUENTE, type FuenteRegla, type NuevaRegla, type ReglaScoring } from "./reglasScoringCrm";
import type { ObjetoPuntaje } from "./scoringCrm";

const num = (n: number) => n.toLocaleString("es-MX");

/** Texto de la condición, p. ej. "250,000 a menos de 1,000,000". */
export function describirCondicion(r: ReglaScoring, etiquetaOpcion?: string): string {
  if (r.fuente === "etapa") return `Etapa = ${r.valor_texto ?? ""}`;
  if (r.fuente === "contacto_ligado" || r.fuente === "pricing_respondida") return ETIQUETA_FUENTE[r.fuente];
  if (r.opcion_id) return `Opción: ${etiquetaOpcion ?? "(archivada)"}`;
  if (r.min !== null && r.max !== null) return `${num(r.min)} a menos de ${num(r.max)}`;
  if (r.min !== null) return `${num(r.min)} o más`;
  if (r.max !== null) return `Menos de ${num(r.max)}`;
  return "Capturado";
}


export interface FormaRegla {
  criterio: string; fuente: FuenteRegla; propId: string; opcionId: string;
  etapa: string; min: string; max: string; puntos: string;
}
export const FORMA_VACIA: FormaRegla = {
  criterio: "", fuente: "propiedad", propId: "sin", opcionId: "sin", etapa: "", min: "", max: "", puntos: "10",
};

/** Convierte la forma del formulario en la regla a guardar ("sin" = sin elegir). */
export function armarRegla(
  f: FormaRegla, ctx: { objeto: ObjetoPuntaje; orden: number; conOpciones: boolean; conRango: boolean },
): NuevaRegla {
  const prop = f.fuente === "propiedad" && f.propId !== "sin" ? f.propId : null;
  return {
    objeto: ctx.objeto, criterio: f.criterio, fuente: f.fuente, orden: ctx.orden, activa: true,
    puntos: Number(f.puntos), propiedad_id: prop,
    opcion_id: ctx.conOpciones && f.opcionId !== "sin" ? f.opcionId : null,
    valor_texto: f.fuente === "etapa" ? f.etapa : null,
    min: ctx.conRango ? aNumero(f.min) : null,
    max: ctx.conRango ? aNumero(f.max) : null,
  };
}
