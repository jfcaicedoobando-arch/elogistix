/**
 * v13.624.0 — Política de autorización del cliente ("cliente de casa").
 *
 * Devuelve si el cliente requiere autorizar cotizaciones y/o proformas.
 * Mientras carga se asume `true` (comportamiento conservador: exigir
 * autorización) para no habilitar botones por error.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteAutorizacion {
  requiereAutorizacionCotizacion: boolean;
  requiereAutorizacionProforma: boolean;
  esClienteDeCasa: boolean;
}

const DEFAULT_AUTORIZACION: ClienteAutorizacion = {
  requiereAutorizacionCotizacion: true,
  requiereAutorizacionProforma: true,
  esClienteDeCasa: false,
};

export function useClienteAutorizacion(clienteId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["cliente-autorizacion", clienteId ?? "none"],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async (): Promise<ClienteAutorizacion> => {
      const { data, error } = await supabase
        .from("clientes")
        // SAFE-CAST: columnas nuevas; los tipos generados aún no las incluyen.
        .select("id, requiere_autorizacion_cotizacion, requiere_autorizacion_proforma" as never)
        .eq("id", clienteId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const row = (data ?? null) as unknown as {
        requiere_autorizacion_cotizacion?: boolean | null;
        requiere_autorizacion_proforma?: boolean | null;
      } | null;
      const cot = row?.requiere_autorizacion_cotizacion ?? true;
      const pro = row?.requiere_autorizacion_proforma ?? true;
      return {
        requiereAutorizacionCotizacion: cot,
        requiereAutorizacionProforma: pro,
        esClienteDeCasa: !cot && !pro,
      };
    },
  });

  return {
    autorizacion: query.data ?? DEFAULT_AUTORIZACION,
    isLoading: query.isLoading,
  };
}
