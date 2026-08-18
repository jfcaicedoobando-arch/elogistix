/**
 * Tipos del tab de tracking del embarque. La UI los toma de aquí para no
 * acoplarse al esquema físico (`@/integrations/supabase/types`).
 */
import type { Tables } from "@/types/db";

/** Subconjunto del embarque que necesita la línea de tiempo de tracking. */
export type EmbarqueTracking = Pick<
  Tables<"embarques">,
  | "modo" | "tipo" | "estado" | "etd" | "eta" | "fecha_llegada_real"
  | "fecha_creacion" | "cotizacion_id" | "updated_at" | "naviera" | "aerolinea"
  | "bl_master" | "mawb" | "expediente" | "puerto_destino" | "aeropuerto_destino"
  | "ciudad_destino"
>;
