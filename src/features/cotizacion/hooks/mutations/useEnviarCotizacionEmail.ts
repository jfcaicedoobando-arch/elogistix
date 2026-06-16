import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enviarCotizacionPorEmail, type EnviarEmailInput } from "@/features/cotizacion/services/mutations/enviarPorEmail";
import { toast } from "sonner";

export function useEnviarCotizacionEmail(cotizacionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnviarEmailInput) => enviarCotizacionPorEmail(input),
    onSuccess: (res) => {
      if (res.estado === "enviado") {
        toast.success("Cotización enviada por correo");
      } else if (res.estado === "parcial") {
        toast.warning("Algunos correos no pudieron enviarse");
      } else {
        toast.error("No se pudo enviar el correo");
      }
      if (cotizacionId) {
        qc.invalidateQueries({ queryKey: ["cotizacion", cotizacionId] });
        qc.invalidateQueries({ queryKey: ["cotizacion-envios", cotizacionId] });
      }
      qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface EnvioRow {
  id: string;
  created_at: string;
  enviado_por: string | null;
  destinatarios: Array<{ email: string; nombre?: string }>;
  cc: string[];
  asunto: string | null;
  mensaje: string | null;
  estado: string;
  error: string | null;
  pdf_link_publico: string | null;
  pdf_storage_path: string | null;
}

export function useHistorialEnviosCotizacion(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: ["cotizacion-envios", cotizacionId],
    enabled: !!cotizacionId,
    queryFn: async (): Promise<EnvioRow[]> => {
      const { data, error } = await supabase
        .from("cotizacion_envios")
        .select("id, created_at, enviado_por, destinatarios, cc, asunto, mensaje, estado, error, pdf_link_publico, pdf_storage_path")
        .eq("cotizacion_id", cotizacionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EnvioRow[];
    },
  });
}
