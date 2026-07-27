import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
import { fetchWithRetry } from "@/lib/net/fetchWithRetry";
import { logger } from "@/lib/observability/logger";

export interface CsfParsedData {
  nombre?: string;
  rfc?: string;
  cp?: string;
  direccion?: string;
  ciudad?: string;
  estado?: string;
  regimen_fiscal?: string;
}

/**
 * Sube un PDF de Constancia de Situación Fiscal y extrae los datos fiscales.
 * Resiliente a fallos de red transitorios: reintenta hasta 2 veces con backoff
 * (1s, 3s) y aplica timeout de 60s por intento.
 */
export async function parseCsf(file: File): Promise<CsfParsedData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.csfSessionRequired);
  }

  const res = await fetchWithRetry(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-csf`,
    () => {
      // Construido por intento para evitar reusar un FormData ya consumido.
      const formData = new FormData();
      formData.append("file", file);
      return {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      };
    },
    {
      onRetry: ({ attempt, reason }) => {
        logger.warn("parseCsf", `reintento ${attempt} (${reason})`);
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al procesar el documento" }));
    throw new Error(err.error || "Error al procesar el documento");
  }

  return res.json();
}
