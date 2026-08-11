/**
 * Suscripción realtime al buzón CxP (documentos entrantes).
 *
 * v13.504.0 — El badge del sidebar debe reflejar los pendientes reales: si
 * alguien del equipo sube, captura, retira o reactiva un documento, el conteo
 * se invalida al instante sin esperar el refetch periódico.
 */
import { supabase } from "@/integrations/supabase/client";

/** Suscribe a los cambios del buzón; devuelve la función de cleanup. */
export function subscribeEntrantesBuzon(onChange: () => void): () => void {
  const channel = supabase
    .channel("cxp-entrantes-buzon")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "embarque_facturas_entrantes" },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
