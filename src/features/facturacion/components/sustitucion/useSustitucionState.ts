/**
 * Hook: estado del wizard de sustitución CFDI.
 * Encapsula: paso actual, id de la sustituta, consulta de estado de la
 * sustituta, restauración desde sessionStorage, y auto-reset si el borrador
 * fue eliminado externamente.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearPersisted, readPersisted } from "./persistence";

export type Step = "intro" | "confirmar";

interface SustitutaData {
  id: string;
  estado: string | null;
  uuid_fiscal: string | null;
}

export function useSustitucionState(facturaId: string | null, open: boolean) {
  const [step, setStep] = useState<Step>("intro");
  const [nuevaId, setNuevaId] = useState<string | null>(null);

  const sustitutaQuery = useQuery<SustitutaData | null>({
    queryKey: ["factura-sustituta-estado", nuevaId],
    enabled: !!nuevaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturas")
        .select("id, estado, uuid_fiscal")
        .eq("id", nuevaId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Restaurar progreso al abrir.
  useEffect(() => {
    if (!open || !facturaId) return;
    const persisted = readPersisted(facturaId);
    if (persisted) {
      setNuevaId(persisted.nuevaId);
      setStep("confirmar");
    } else {
      setNuevaId(null);
      setStep("intro");
    }
  }, [open, facturaId]);

  // Reset si el borrador fue eliminado externamente.
  useEffect(() => {
    if (step !== "confirmar" || !nuevaId || sustitutaQuery.isLoading) return;
    if (sustitutaQuery.data === null && facturaId) {
      clearPersisted(facturaId);
      toast.info("El borrador sustituto ya no existe. Reinicia el proceso.");
      setNuevaId(null);
      setStep("intro");
    }
  }, [step, nuevaId, sustitutaQuery.data, sustitutaQuery.isLoading, facturaId]);

  const sustitutaTimbrada =
    !!sustitutaQuery.data?.uuid_fiscal && sustitutaQuery.data.estado === "Emitida";
  const sustitutaEstadoLabel = sustitutaQuery.data?.estado ?? "…";

  return {
    step, setStep, nuevaId, setNuevaId,
    sustitutaQuery, sustitutaTimbrada, sustitutaEstadoLabel,
  };
}
