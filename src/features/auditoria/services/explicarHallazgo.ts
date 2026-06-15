/**
 * Servicio: invoca la edge function `auditoria-explicar-hallazgo`.
 * Capa de acceso a Supabase para que los hooks no importen el cliente directamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ExplicacionHallazgo {
  explicacion: string;
  modelo: string;
}

export interface ExplicarHallazgoInput {
  embarque_id: string;
  regla: string;
  detalle: unknown;
}

export async function explicarHallazgo(
  input: ExplicarHallazgoInput,
): Promise<ExplicacionHallazgo> {
  const { data, error } = await supabase.functions.invoke<ExplicacionHallazgo>(
    "auditoria-explicar-hallazgo",
    { body: input },
  );
  if (error) throw error;
  if (!data?.explicacion) throw new Error("Respuesta vacía");
  return data;
}
