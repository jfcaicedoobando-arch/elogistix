/**
 * Ola 8 · B2 — Política única de contraseñas.
 *
 * Antes cada pantalla reimplementaba su propia regla: `min(6)` en registro y
 * restablecimiento, `length < 8` en el cambio propio y en el alta por admin, y
 * `length < 6` en la edge function (la más laxa, y la que de verdad llega a
 * `auth.admin.createUser`). Este módulo es la única fuente de verdad para el
 * frontend; la edge function replica el mismo mínimo en su propio archivo por
 * no poder importar de `src/`.
 */
import { z } from "zod";

/** Mínimo de caracteres exigido en cualquier alta o cambio de contraseña. */
export const PASSWORD_MIN = 10;

/** Máximo aceptado por Supabase Auth (bcrypt trunca en 72 bytes). */
export const PASSWORD_MAX = 72;

/** Longitud sugerida al generar una contraseña automáticamente. */
export const PASSWORD_SUGERIDA = 14;

export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres. Combina mayúsculas, minúsculas, números y símbolos.`;

const MSG_CORTA = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
const MSG_LARGA = `La contraseña no puede exceder ${PASSWORD_MAX} caracteres.`;

/** Schema zod reutilizable para campos de contraseña. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, MSG_CORTA)
  .max(PASSWORD_MAX, MSG_LARGA);

/**
 * Validación imperativa para formularios que no usan zod.
 * @returns mensaje de error en español, o `null` si la contraseña es válida.
 */
export function validarPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return MSG_CORTA;
  if (password.length > PASSWORD_MAX) return MSG_LARGA;
  return null;
}
