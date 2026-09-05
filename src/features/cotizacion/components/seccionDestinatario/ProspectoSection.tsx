/**
 * Bloque "Prospecto" del paso 1 de cotización.
 *
 * P0 (cotizaciones huérfanas): el cotizador ya NO crea prospectos ni captura
 * su ficha fiscal. Sólo se vincula un origen CRM existente y elegible; el alta
 * de prospectos vive en el módulo CRM.
 */
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VinculoChip } from "./VinculoChip";
import { BuscadorProspectos } from "./BuscadorProspectos";
import type { ProspectoMatch } from "@/features/crm/hooks";

interface Props {
  tieneVinculo: boolean;
  vinculoConfirmado: boolean;
  oportunidadId: string;
  leadId: string;
  prospectoEmpresa: string;
  onSelectMatch: (m: ProspectoMatch) => void;
  onDesvincular: () => void;
  /** Bug 1: moneda de la oportunidad vinculada, para capturar en la correcta. */
  monedaOportunidad?: string | null;
}

export function ProspectoSection({
  tieneVinculo,
  vinculoConfirmado,
  oportunidadId,
  leadId,
  prospectoEmpresa,
  onSelectMatch,
  onDesvincular,
  monedaOportunidad,
}: Props) {
  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-muted-foreground">
          Vincula la cotización a un prospecto calificado o a una oportunidad abierta del CRM.
        </p>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href="/crm/leads" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir CRM
          </a>
        </Button>
      </div>

      {tieneVinculo ? (
        <>
        <VinculoChip
          oportunidadId={oportunidadId}
          leadId={leadId}
          nombre={prospectoEmpresa}
          onDesvincular={onDesvincular}
          puedeDesvincular={!vinculoConfirmado}
          moneda={monedaOportunidad}
        />
        {monedaOportunidad && (
          <p className="text-body-sm text-muted-foreground">
            Captura los costos y conceptos de venta en {monedaOportunidad}: la oportunidad
            del CRM está registrada en esa moneda y no se puede vincular una cotización
            en otra.
          </p>
        )}
        </>
      ) : (
        <BuscadorProspectos onSelect={onSelectMatch} />
      )}
    </div>
  );
}
