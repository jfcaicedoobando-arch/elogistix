/**
 * Lectura y alineación de la moneda de una oportunidad CRM.
 *
 * Contexto: el trigger `crm_cerrar_oportunidad_desde_cotizacion` rechaza
 * aceptar una cotización cuya moneda difiere de la de la oportunidad
 * (`LC_MONEDA_INCOMPATIBLE`). Antes el vendedor tenía que salir a CRM a
 * corregirla a mano; estas dos funciones permiten resolverlo en el mismo paso.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Moneda vigente de la oportunidad. `null` = sin id, no existe o RLS la filtró.
 * La guardia de id vacío evita mandar `"null"` a un `uuid` (22P02), que la app
 * mostraba como falso error de conexión (JAVASCRIPT-REACT-6A/6B).
 */
export async function fetchMonedaOportunidad(
  oportunidadId: string | null | undefined,
): Promise<string | null> {
  if (!oportunidadId) return null;
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select("id, moneda")
    .eq("id", oportunidadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.moneda ?? null;
}

/**
 * Alinea la moneda de la oportunidad a la de la cotización.
 * Devuelve `false` cuando la actualización no tocó ninguna fila (oportunidad
 * inexistente, eliminada o filtrada por RLS): no inventamos éxito.
 */
export async function alinearMonedaOportunidad(
  oportunidadId: string,
  moneda: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    // SAFE-CAST: `moneda` es un text libre en CRM; el valor proviene del enum
    // `moneda` de la cotización, por lo que siempre es válido.
    .update({ moneda } as { moneda: string })
    .eq("id", oportunidadId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
