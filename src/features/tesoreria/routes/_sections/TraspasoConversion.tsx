/**
 * Sección de conversión + resumen del traspaso.
 *
 * Vive fuera del diálogo para mantenerlo simple (Power of 10: complejidad ≤16)
 * y para que el acomodo no se desfase al cambiar de moneda: el tipo de cambio
 * ocupa siempre su propio renglón, nunca una celda de la rejilla de importes.
 */
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/shared/NumericInput";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { TraspasoResumen } from "./TraspasoResumen";
import { etiquetaTc, type MonedaTc } from "@/features/tesoreria/domain/tcPar";

interface Props {
  monedaOrigen: string;
  monedaDestino: string;
  mismoMoneda: boolean;
  par: { base: MonedaTc; quote: MonedaTc } | null;
  tcQuote: number;
  onTcQuoteChange: (v: number) => void;
  montoOrigen: number;
  comision: number;
  montoDestino: number;
  fechaTcDof: string | null;
  /** MNY: el T/C se capturó a mano (no se re-sugiere al cambiar la fecha). */
  tcEsManual?: boolean;
}

export function TraspasoConversion({
  monedaOrigen, monedaDestino, mismoMoneda, par, tcQuote, onTcQuoteChange,
  montoOrigen, comision, montoDestino, fechaTcDof, tcEsManual = false,
}: Props) {

  const resumen = (
    <TraspasoResumen
      monedaOrigen={monedaOrigen}
      monedaDestino={monedaDestino}
      montoOrigen={montoOrigen}
      comision={comision}
      montoDestino={montoDestino}
      par={mismoMoneda ? null : par}
      tcQuote={tcQuote}
    />
  );

  if (mismoMoneda || !par) {
    if (montoOrigen <= 0) return null;
    return (
      <FormDialogSection title="Resumen" cols={1}>
        {resumen}
      </FormDialogSection>
    );
  }

  return (
    <FormDialogSection
      title="Conversión"
      description="Las cuentas son de distinta moneda: captura el tipo de cambio de tu banco (hasta 4 decimales)."
      cols={1}
    >
      <div className="space-y-1.5 md:max-w-xs">
        <Label htmlFor="traspaso-tc">{etiquetaTc(par)} *</Label>
        <NumericInput
          id="traspaso-tc"
          decimals
          value={tcQuote}
          onChange={onTcQuoteChange}
          placeholder={par.quote === "MXN" ? "18.4235" : "1.0800"}
        />
        {tcQuote > 0 ? (
          fechaTcDof ? (
            <p className="text-body-sm text-muted-foreground">
              Sugerido con el TC DOF publicado el {fechaTcDof}. Puedes editarlo si tu banco usó otro.
            </p>
          ) : null
        ) : (
          <p className="text-body-sm text-destructive" role="alert">
            Captura el tipo de cambio: es obligatorio porque las cuentas son de distinta moneda.
          </p>
        )}
      </div>
      {resumen}
    </FormDialogSection>
  );
}
