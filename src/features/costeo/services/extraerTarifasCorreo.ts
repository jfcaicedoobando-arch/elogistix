import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { CorreoDescargado } from "../tarifario/correo/parsearCorreoTarifas";
import type { ProveedorCorreo } from "../tarifario/correo/proveedoresCorreo";

export type CorreoTarifas = CorreoDescargado & { proveedor: ProveedorCorreo };

const respuestaSchema = z.object({
  correos: z.array(z.object({
    proveedor: z.enum(["longsail", "golden", "oriental", "rainbow"]),
    asunto: z.string(),
    fecha: z.string(),
    textoPlano: z.string(),
    xlsxBase64: z.string().nullable(),
    xlsxNombre: z.string().nullable(),
    error: z.string().optional(),
  })),
});

/** Valida el contrato de Edge antes de entregar los correos al parser. */
export async function extraerTarifasCorreo(organizationId: string): Promise<CorreoTarifas[]> {
  if (!organizationId.trim()) throw new Error("Falta la organización");
  const { data, error } = await supabase.functions.invoke<unknown>("extraer-tarifas-correo", {
    body: { organizationId },
  });
  if (error) throw error;
  const respuesta = respuestaSchema.safeParse(data);
  if (!respuesta.success) throw new Error("El servicio de extracción devolvió una respuesta inválida");
  return respuesta.data.correos;
}
