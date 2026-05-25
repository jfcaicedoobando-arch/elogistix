import { supabase } from "@/integrations/supabase/client";
import type { EmbarqueListExtras } from "./paginados";

export type { EmbarqueListExtras } from "./paginados";

export async function fetchEmbarquesRelacionados(_embarqueId: string, blMaster: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, bl_house, contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, estado")
    .eq("bl_master", blMaster)
    .order("contenedor", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEmbarquesListExtras(ids: string[]): Promise<EmbarqueListExtras> {
  if (ids.length === 0) return { liquidacion: {}, docs: {} };
  const { data, error } = await supabase.rpc("embarques_list_extras", { p_ids: ids });
  if (error) throw error;

  const liquidacion: EmbarqueListExtras["liquidacion"] = {};
  const docs: EmbarqueListExtras["docs"] = {};
  (data ?? []).forEach(
    (row: {
      embarque_id: string;
      costos_total: number;
      costos_pagados: number;
      docs_total: number;
      docs_pendientes: number;
    }) => {
      liquidacion[row.embarque_id] = {
        total: Number(row.costos_total),
        pagados: Number(row.costos_pagados),
      };
      docs[row.embarque_id] = {
        total: Number(row.docs_total),
        pendientes: Number(row.docs_pendientes),
      };
    },
  );
  return { liquidacion, docs };
}
