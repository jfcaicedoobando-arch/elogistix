/**
 * Bloque "Prospecto" del paso 1 de cotización.
 * Permite vincular a lead/oportunidad existente o crear uno nuevo.
 */
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { VinculoChip } from "./VinculoChip";
import { BuscadorProspectos } from "./BuscadorProspectos";
import { FormularioNuevoProspecto } from "./FormularioNuevoProspecto";
import type { ProspectoMatch } from "@/features/crm/hooks";

interface Props {
  modo: "vincular" | "nuevo";
  onChangeModo: (m: "vincular" | "nuevo") => void;
  tieneVinculo: boolean;
  oportunidadId: string;
  leadId: string;
  prospectoEmpresa: string;
  onSelectMatch: (m: ProspectoMatch) => void;
  onDesvincular: () => void;
}

export function ProspectoSection({
  modo,
  onChangeModo,
  tieneVinculo,
  oportunidadId,
  leadId,
  prospectoEmpresa,
  onSelectMatch,
  onDesvincular,
}: Props) {
  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
      <RadioGroup
        value={modo}
        onValueChange={(v) => onChangeModo(v as "vincular" | "nuevo")}
        className="flex flex-col gap-2 sm:flex-row sm:gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="vincular" id="modo-vincular" />
          <Label htmlFor="modo-vincular" className="cursor-pointer text-sm font-medium">
            Vincular a lead u oportunidad existente
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="nuevo" id="modo-nuevo" />
          <Label htmlFor="modo-nuevo" className="cursor-pointer text-sm font-medium">
            Crear nuevo prospecto
          </Label>
        </div>
      </RadioGroup>

      {modo === "vincular" ? (
        tieneVinculo ? (
          <VinculoChip
            oportunidadId={oportunidadId}
            leadId={leadId}
            nombre={prospectoEmpresa}
            onDesvincular={onDesvincular}
          />
        ) : (
          <BuscadorProspectos onSelect={onSelectMatch} />
        )
      ) : (
        <FormularioNuevoProspecto />
      )}
    </div>
  );
}
