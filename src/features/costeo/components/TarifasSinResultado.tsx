/**
 * Estado vacío del Top 3 de tarifas.
 *
 * P2 (2026-09-02): antes decía siempre "No hay tarifas vigentes", incluso
 * cuando la tarifa existía en borrador (pendiente de aprobación) o vencida.
 */
import { FileSearch, Clock, CalendarX } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import type { DiagnosticoTarifas } from "@/features/costeo/services/diagnosticoTarifas";

export interface TarifasSinResultadoProps {
  diagnostico?: DiagnosticoTarifas;
}

export function TarifasSinResultado({ diagnostico }: TarifasSinResultadoProps) {
  if (diagnostico === "pendiente") {
    return (
      <EmptyStateInline
        icon={Clock}
        message="Existe una tarifa para esta combinación, pero está pendiente de aprobación."
        hint="Pide a Operaciones que la apruebe en “Catálogo de tarifas” para poder usarla."
      />
    );
  }
  if (diagnostico === "vencida") {
    return (
      <EmptyStateInline
        icon={CalendarX}
        message="La tarifa de esta combinación está vencida."
        hint="Actualiza su vigencia o captura una nueva en “Catálogo de tarifas”."
      />
    );
  }
  return (
    <EmptyStateInline
      icon={FileSearch}
      message="No hay tarifas vigentes para esta combinación."
      hint="Captura una nueva en “Catálogo de tarifas”."
    />
  );
}
