/**
 * Hook: estado del wizard de sustitución CFDI.
 * Encapsula: paso actual, id de la sustituta, consulta de estado de la
 * sustituta, restauración desde sessionStorage, y auto-reset si el borrador
 * fue eliminado externamente.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notifyInfo } from "@/lib/ui/appFeedback";
import { fetchSustitutaEstado, type SustitutaEstado } from "@/features/facturacion/services/sustitucionEstado";
import { facturacion as facturacionKeys } from "@/features/facturacion/queryKeys";
import { clearPersisted, readPersisted } from "@/features/facturacion/services/sustitucionPersistence";

export type Step = "intro" | "confirmar";

type SustitutaData = SustitutaEstado;

export function useSustitucionState(facturaId: string | null, open: boolean) {
  const [step, setStep] = useState<Step>("intro");
  const [nuevaId, setNuevaId] = useState<string | null>(null);

  const sustitutaQuery = useQuery<SustitutaData | null>({
    queryKey: facturacionKeys.sustitutaEstado(nuevaId),
    enabled: !!nuevaId && open,
    // Al reabrir el diálogo siempre reconsultamos: la sustituta pudo timbrarse
    // en otra pestaña o desde el detalle mientras el diálogo estaba cerrado.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: () => fetchSustitutaEstado(nuevaId!),
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
      notifyInfo(undefined, { title: "El borrador sustituto ya no existe. Reinicia el proceso." });
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
