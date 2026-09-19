/**
 * Esquema y copy de la pantalla de restablecer/crear contraseña.
 * Extraído de `ResetPassword.tsx` para respetar el límite de 200 líneas
 * (Power of 10); sin cambios de comportamiento.
 */
import { z } from "zod";
import { passwordSchema } from "@/lib/passwords/policySchema";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

/**
 * v13.312.19 — Ola 1 · PR-6 paso 2: migrado de 8 `useState` a RHF+zod.
 */
export const resetSchema = z
  .object({
    password: passwordSchema,
    password2: passwordSchema,
  })
  .refine((v) => v.password === v.password2, {
    path: ["password2"],
    message: COPY_VALIDACION.contrasenasNoCoinciden,
  });

export type ResetValues = z.infer<typeof resetSchema>;

export interface CopyPantallaReset {
  titulo: string;
  intro: string;
  exito: string;
  exitoDetalle: string;
}

/**
 * Copy de la pantalla. `invitacion` = el usuario llegó por el enlace de
 * invitación al portal y todavía no tiene contraseña.
 */
export function copyPantalla(esInvitacion: boolean): CopyPantallaReset {
  return esInvitacion
    ? {
        titulo: "Crea tu contraseña",
        intro: "Define la contraseña con la que entrarás a tu portal de Libre Carga.",
        exito: "Tu contraseña quedó lista",
        exitoDetalle: "Te llevaremos a tu portal…",
      }
    : {
        titulo: "Restablecer contraseña",
        intro: "Ingresa tu nueva contraseña para tu cuenta de Libre Carga.",
        exito: "Contraseña actualizada",
        exitoDetalle: "Te llevaremos al inicio de sesión…",
      };
}
