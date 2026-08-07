/**
 * Servicios relacionados al contenedor del embarque.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";

export async function actualizarContenedorEmbarque(
  embarqueId: string,
  contenedor: string,
): Promise<void> {
  const { error } = await supabase
    .from("embarques")
    .update({ contenedor })
    .eq("id", embarqueId);
  if (error) throw error;
  await registrarBitacoraEmbarque({
    accion: "Actualizó contenedor de embarque",
    entidadId: embarqueId,
    detalles: { contenedor },
  });
}
