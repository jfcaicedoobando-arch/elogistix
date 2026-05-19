/** Normaliza descripciones cosméticas en proformas. */
export function formatearDescripcionConcepto(descripcion: string): string {
  if (descripcion.toLowerCase() === "flete terrestre") {
    return "Servicios de Logística (Flete Terrestre)";
  }
  return descripcion;
}

import type { Tables } from "@/integrations/supabase/types";

export type ProformaRow = Tables<"proformas">;
export type EmbarqueRow = Tables<"embarques">;
export type ClienteRow = Tables<"clientes">;

export type EmbarqueLite = Pick<
  EmbarqueRow,
  | "expediente"
  | "bl_master"
  | "modo"
  | "tipo"
  | "incoterm"
  | "puerto_origen"
  | "puerto_destino"
  | "aeropuerto_origen"
  | "aeropuerto_destino"
  | "ciudad_origen"
  | "ciudad_destino"
  | "naviera"
  | "aerolinea"
  | "descripcion_mercancia"
>;

export type ClienteLite =
  | Pick<ClienteRow, "nombre" | "rfc" | "direccion" | "ciudad" | "estado" | "cp">
  | null
  | undefined;
