/**
 * Schema zod de contraseña, separado de `policy.ts` a propósito.
 *
 * `policy.ts` lo importan pantallas que viven en el chunk inicial (cambio de
 * contraseña, medidor de fuerza, restablecer), y traerse `zod` por esa ruta
 * metía toda la librería al arranque. Aquí queda sólo el schema, que usan
 * exclusivamente los formularios con `zodResolver`; las constantes y la
 * validación imperativa siguen en `policy.ts` y no dependen de zod.
 */
import { z } from "zod";
import { PASSWORD_MIN, PASSWORD_MAX, MSG_PASSWORD_CORTA, MSG_PASSWORD_LARGA } from "./policy";

/** Schema zod reutilizable para campos de contraseña. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, MSG_PASSWORD_CORTA)
  .max(PASSWORD_MAX, MSG_PASSWORD_LARGA);
