import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";

export interface CfdiConceptoParsed {
  descripcion: string;
  importe: number;
}

export interface CfdiParsedResponse {
  cfdi: {
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    moneda: string;
    tipo_cambio: number;
    subtotal: number;
    total: number;
    iva_trasladado: number;
    retenciones: number;
    emisor: { rfc: string; nombre: string; regimen: string };
    receptor: { rfc: string; nombre: string };
    conceptos: CfdiConceptoParsed[];
  };
  ai: { categoria_id: string | null; notas: string };
}

export async function parseCfdiXml(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<CfdiParsedResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("categorias", JSON.stringify(categorias));

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.csfSessionRequired);
  }

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-cfdi-xml`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al procesar el XML" }));
    throw new Error(err.error || "Error al procesar el XML");
  }
  return res.json();
}
