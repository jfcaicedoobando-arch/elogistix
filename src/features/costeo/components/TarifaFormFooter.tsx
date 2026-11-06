import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { BotonCancelarTarifa } from "./TarifaFormCancelar";

export function TarifaFormFooter({ pendiente, valido, tooltipFaltantes, guardarLabel, onCerrar }: {
  pendiente: boolean;
  valido: boolean;
  tooltipFaltantes?: string;
  guardarLabel: string;
  onCerrar: () => void;
}) {
  return (
    <div className="flex w-full justify-end gap-2">
      <BotonCancelarTarifa disabled={pendiente} onCerrarSinGuarda={onCerrar} />
      <Hint label={pendiente ? "Guardando…" : tooltipFaltantes}>
        <Button
          type="submit"
          form="tarifa-form"
          disabled={!valido}
          aria-busy={pendiente || undefined}
          aria-describedby={tooltipFaltantes ? "tarifa-form-resumen" : undefined}
          loading={pendiente}>
          {guardarLabel}
        </Button>
      </Hint>
    </div>
  );
}
