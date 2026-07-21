/**
 * Fase 6 UX · Aviso visible cuando la conversión MXN de los KPIs de Dirección
 * está usando el tipo de cambio de emergencia (Banxico caído o token faltante).
 * Los KPIs se calculan sin problemas, pero el usuario debe saber que las cifras
 * son estimadas para no tomar decisiones críticas basadas en un TC aproximado.
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useExchangeRates } from "@/features/catalogos/hooks";

export function TipoCambioFallbackBanner() {
  const { data } = useExchangeRates();
  if (!data?.esFallback) return null;
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Tipo de cambio estimado</AlertTitle>
      <AlertDescription>
        No pudimos obtener el tipo de cambio oficial de Banxico. Los importes en
        MXN se están calculando con un valor de referencia (USD ≈ {data.usdMxn.toFixed(2)}
        , EUR ≈ {data.eurMxn.toFixed(2)}). Reintenta más tarde o valida con tu equipo
        financiero antes de tomar decisiones basadas en estas cifras.
      </AlertDescription>
    </Alert>
  );
}
