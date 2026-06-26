/**
 * Descarga PDF/XML de un CFDI (factura o REP) llamando a la edge function
 * `facturapi-descargar`. Devuelve un Blob listo para guardar en disco.
 *
 * Las URLs almacenadas en `factura_pdf_url|xml_url` y `rep_pdf_url|xml_url`
 * apuntan a FacturApi y requieren la API key de la organización; por eso no
 * se pueden abrir directamente desde el navegador y necesitan este proxy.
 */
import { supabase } from "@/integrations/supabase/client";

export type CfdiTipo = "pdf" | "xml";

export interface DescargarCfdiOpts {
  tipo: CfdiTipo;
  facturaId?: string;
  pagoId?: string;
}

/** Detecta si la URL guardada apunta a FacturApi (necesita proxy). */
export function esUrlFacturapi(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("facturapi.io");
}

export interface CfdiBlob {
  blob: Blob;
  filename: string;
}

export async function fetchCfdiFacturapi(opts: DescargarCfdiOpts): Promise<CfdiBlob> {
  if (!opts.facturaId && !opts.pagoId) {
    throw new Error("facturaId o pagoId requerido");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
  const url = `https://${projectId}.supabase.co/functions/v1/facturapi-descargar`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tipo: opts.tipo,
      factura_id: opts.facturaId,
      pago_id: opts.pagoId,
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

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `cfdi.${opts.tipo}`;
  return { blob, filename };
}

export async function descargarCfdiFacturapi(opts: DescargarCfdiOpts): Promise<void> {
  const { blob, filename } = await fetchCfdiFacturapi(opts);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
