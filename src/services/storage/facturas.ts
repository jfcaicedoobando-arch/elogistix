/**
 * Helpers para el bucket privado `facturas`.
 *
 * Las facturas pasaron a ser archivos privados (acceso multi-tenant). Los
 * registros antiguos guardaban URLs públicas absolutas; las nuevas guardan
 * sólo el path. Este helper acepta cualquiera de los dos formatos y devuelve
 * una URL firmada de corta duración.
 */
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_PREFIX = "/storage/v1/object/public/facturas/";
const SIGN_EXPIRES_S = 60 * 5;

export function extractFacturaPath(stored: string): string {
  const idx = stored.indexOf(PUBLIC_PREFIX);
  if (idx >= 0) return stored.slice(idx + PUBLIC_PREFIX.length);
  return stored;
}

export async function getFacturaSignedUrl(stored: string): Promise<string> {
  const path = extractFacturaPath(stored);
  const { data, error } = await supabase.storage
    .from("facturas")
    .createSignedUrl(path, SIGN_EXPIRES_S);
  if (error) throw error;
  return data.signedUrl;
}

export async function openFacturaInNewTab(stored: string): Promise<void> {
  const url = await getFacturaSignedUrl(stored);
  window.open(url, "_blank", "noopener,noreferrer");
}
