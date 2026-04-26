import { supabase } from "@/integrations/supabase/client";

export interface CsfParsedData {
  nombre?: string;
  rfc?: string;
  cp?: string;
  direccion?: string;
  ciudad?: string;
  estado?: string;
}

/**
 * Sube un PDF de Constancia de Situación Fiscal y extrae los datos fiscales.
 */
export async function parseCsf(file: File): Promise<CsfParsedData> {
  const formData = new FormData();
  formData.append("file", file);

  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-csf`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al procesar el documento" }));
    throw new Error(err.error || "Error al procesar el documento");
  }

  return res.json();
}
