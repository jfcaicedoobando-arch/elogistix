/**
 * Helpers zod compartidos por los schemas de mutación. Extraído de
 * `mutationSchemas.ts` (Power of 10: máx. 200 líneas por archivo).
 */
import { z } from "zod";

export const nonEmpty = (label: string, max = 200) =>
  z
    .string({ error: `${label}: requerido.` })
    .trim()
    .min(1, `${label}: requerido.`)
    .max(max, `${label}: máximo ${max} caracteres.`);

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(""))
    .or(z.null());

// B-023 (v13.320.43): RFC mexicano con formato SAT.
// - Persona física: 4 letras + 6 dígitos (AAMMDD) + 3 alfanuméricos = 13.
// - Persona moral:  3 letras + 6 dígitos (AAMMDD) + 3 alfanuméricos = 12.
// Se acepta vacío/null (campo opcional) y se normaliza a mayúsculas antes de validar.
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
export const rfcSchema = z
  .string()
  .trim()
  .max(20, "RFC: máximo 20 caracteres.")
  .transform((v) => v.toUpperCase())
  .refine((v) => v === "" || RFC_RE.test(v), "RFC: formato inválido (12 o 13 caracteres, patrón SAT).")
  .optional()
  .or(z.literal(""))
  .or(z.null());

// Ola 7 (M3): el correo se normaliza (minúsculas, sin espacios) para que la
// unicidad por organización en base de datos sea consistente.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Correo: máximo 254 caracteres.")
  .email("Correo: formato inválido.")
  .optional()
  .or(z.literal(""))
  .or(z.null());

export const uuidSchema = z.string().uuid("Identificador inválido.");
