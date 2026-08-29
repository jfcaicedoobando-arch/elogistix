/**
 * Descarga el paquete ZIP mensual de CFDI (PDF+XML) generado del lado del PAC
 * vía la edge function `facturapi-descargar-zip` (SDK FacturApi 4.20.0,
 * métodos zip-requests). Devuelve un Blob listo para guardar en disco.
 *
 * v13.794.0
 */
import { supabase } from "@/integrations/supabase/client";

export interface DescargarZipMensualInput {
  organizationId: string;
  year: number;
  month: number; // 1-12
}

export async function fetchZipMensual(input: DescargarZipMensualInput): Promise<Blob> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
  const url = `https://${projectId}.supabase.co/functions/v1/facturapi-descargar-zip`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      organization_id: input.organizationId,
      year: input.year,
      month: input.month,
    }),
  });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      msg = j.message ?? j.error ?? msg;
    } catch { /* respuesta no-JSON */ }
    throw new Error(msg);
  }

  return await res.blob();
}

export function nombreZipMensual(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `cfdis-${year}-${mm}.zip`;
}

export async function descargarZipMensual(input: DescargarZipMensualInput): Promise<void> {
  const blob = await fetchZipMensual(input);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = nombreZipMensual(input.year, input.month);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
