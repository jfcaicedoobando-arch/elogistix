import { supabase } from "@/integrations/supabase/client";

export interface GlobalSearchRpcRow {
  id: string;
  label: string;
  sublabel: string;
  tipo: string;
  url: string;
}

export async function buscarGlobal(
  termino: string,
  limite = 5,
): Promise<GlobalSearchRpcRow[]> {
  if (!termino.trim()) return [];
  const { data, error } = await supabase.rpc("busqueda_global", { termino, limite });
  if (error) {
    console.error("Error en búsqueda global:", error);
    return [];
  }
  return (data ?? []) as GlobalSearchRpcRow[];
}

/** Crea una signed URL para un documento del bucket `documentos`. */
export async function createDocumentoSignedUrl(
  archivo: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(archivo, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
