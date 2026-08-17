/**
 * Bloque 2.2 — Validación zod en el boundary de mutaciones.
 *
 * Los wizards (Embarque, Cotización) ya validan paso a paso con zod, pero
 * existen otras vías de escritura (services llamados desde controllers,
 * importaciones futuras, RPC duplicate fix) donde nada garantiza que el
 * payload final cumpla las invariantes mínimas. Estos schemas son la última
 * red de seguridad antes de tocar la base.
 *
 * Reglas:
 *  - Mensajes en español MX, tuteo, con punto final.
 *  - Las claves del schema reflejan los campos persistidos, no los del form.
 *  - `parseOrThrow` re-lanza un Error con el primer issue (mensaje legible
 *    para toasts) y conserva el ZodError original como `cause`.
 *
 * Los schemas por dominio (Cliente, Cotización, Embarque/Notas/Tracking) y
 * los helpers zod compartidos se extrajeron a archivos hermanos en
 * 13.358.x (Power of 10: máx. 200 líneas por archivo) y se re-exportan aquí
 * para no romper los imports existentes.
 */
import { z } from "zod";
import { getFieldLabel } from "./fieldLabels";

export * from "./mutationSchemas.shared";
export * from "./mutationSchemas.cliente";
export * from "./mutationSchemas.cotizacion";
export * from "./mutationSchemas.otros";

// ── Helpers ───────────────────────────────────────────────────────────

/** Lanza Error legible si el payload no pasa el schema. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, contexto: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const message = first?.message ?? "Datos inválidos.";
  const path = first?.path?.length ? first.path.join(".") : undefined;
  // La mayoría de nuestros schemas ya incluyen su propia etiqueta legible en
  // el mensaje (p. ej. "Nombre del cliente: requerido."); anteponer el path
  // crudo de Zod duplicaba la etiqueta con el nombre técnico del campo
  // (`descripcion_mercancia: Descripción de la mercancía: requerido.`).
  // Sólo enriquecemos con la etiqueta del catálogo cuando el mensaje NO trae
  // ya su propia etiqueta.
  const yaTraeEtiqueta = /^.{2,60}:\s/.test(message);
  const detalle = yaTraeEtiqueta || !path ? message : `${getFieldLabel(path)}: ${message}`;
  const err = new Error(`${contexto} — ${detalle}`);
  (err as Error & { cause?: unknown }).cause = result.error;
  throw err;
}
