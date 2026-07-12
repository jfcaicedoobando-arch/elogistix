/**
 * Schema Zod para el formulario de acceso a la demo.
 * Extraído para mantener el componente por debajo del límite de 200 líneas
 * (Power of 10 #4) y facilitar tests unitarios de validación.
 */
import { z } from "zod";

export const demoAccessSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre completo.").max(120),
  empresa: z.string().trim().min(2, "Ingresa el nombre de tu empresa.").max(120),
  email: z.string().trim().email("Email inválido.").max(255),
  telefono: z.string().trim().min(8, "Ingresa un teléfono válido."),
});


