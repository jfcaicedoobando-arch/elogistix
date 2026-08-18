/**
 * Suscripción realtime al buzón CxP (documentos entrantes).
 *
 * v13.504.0 — El badge del sidebar debe reflejar los pendientes reales: si
 * alguien del equipo sube, captura, retira o reactiva un documento, el conteo
 * se invalida al instante sin esperar el refetch periódico.
 *
 * EC-09 (Ola 2) — El canal escuchaba `embarque_facturas_entrantes` SIN filtro:
 * llegaban eventos de TODAS las organizaciones (ruido cross-tenant e
 * invalidaciones provocadas por otros tenants). Se filtra por
 * `organization_id`, igual que `subscribeNotificaciones`.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Suscribe a los cambios del buzón de la organización indicada.
 * @returns función de cleanup que remueve el canal.
 */
export function subscribeEntrantesBuzon(
  organizationId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`cxp-entrantes-buzon-${organizationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "embarque_facturas_entrantes",
        filter: `organization_id=eq.${organizationId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
