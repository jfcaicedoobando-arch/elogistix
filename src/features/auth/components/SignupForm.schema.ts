import { z } from "zod";
import { passwordSchema } from "@/lib/passwords/policy";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

/**
 * Ola 10 — Schema del alta de cuenta, extraído de `SignupForm.tsx` para
 * respetar el límite de 200 líneas (Power-of-10 #4). Valida el match de
 * contraseñas y la aceptación de términos.
 */
export const signupSchema = z
  .object({
    name: z.string().min(1, COPY_VALIDACION.nombreRequerido),
    company: z
      .string()
      .trim()
      .min(2, "El nombre de la empresa debe tener entre 2 y 120 caracteres.")
      .max(120, "El nombre de la empresa debe tener entre 2 y 120 caracteres."),
    phone: z.string().optional(),
    email: z.string().email(COPY_VALIDACION.correoInvalido),
    password: passwordSchema,
    password2: passwordSchema,
    acceptTerms: z.literal(true, {
      message: COPY_VALIDACION.terminosRequeridos,
    }),
  })
  .refine((v) => v.password === v.password2, {
    path: ["password2"],
    message: COPY_VALIDACION.contrasenasNoCoinciden,
  });

export type SignupValues = z.infer<typeof signupSchema>;
