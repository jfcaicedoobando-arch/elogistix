/**
 * Renglón de un concepto_costo pendiente dentro del paso "Vincular a costos de
 * embarque" del wizard de captura de factura de proveedor.
 *
 * Regla de moneda (Ola conciliación multi-moneda): el importe aplicado se
 * captura SIEMPRE en la moneda de la factura. Si el costo está cotizado en otra
 * moneda se muestra su equivalencia con el T/C DOF de la fecha de emisión y el
 * T/C implícito de lo capturado.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Hint } from "@/components/shared/Hint";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import { VincularConceptoAvisos } from "./VincularConceptoAvisos";
import { resumirMonedaVinculo, type TcPivote } from "@/features/cxp/utils/vinculoMoneda";
import type { ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { SeleccionLinea } from "@/features/cxp/types";

interface Props {
  concepto: ConceptoCostoAbierto;
  seleccion: SeleccionLinea | undefined;
  onToggle: (concepto: ConceptoCostoAbierto, checked: boolean, montoBase?: number) => void;
  onChangeMonto: (conceptoId: string, monto: number) => void;
  /** Moneda de la factura que se está capturando. */
  facturaMoneda: string;
  /** T/C DOF de la fecha de emisión (pivote MXN). */
  tc: TcPivote | null;
  /** Fecha de publicación DOF usada (ISO). */
  tcFecha?: string | null;
}

const fmtTc = (n: number) => n.toFixed(4);

export function VincularConceptoRow({
  concepto: it, seleccion: sel, onToggle, onChangeMonto,
  facturaMoneda, tc, tcFecha,
}: Props) {
  const checked = !!sel;
  const { mismaMoneda, errorMoneda, factor, cotizadoEnFactura, sinTc, excede, implicito, desviado } =
    resumirMonedaVinculo({ monedaCosto: it.moneda, monedaFactura: facturaMoneda,
      montoCosto: it.monto, montoCapturado: sel?.monto, tc });

  const handleToggle = (v: boolean) => {
    if (v && (errorMoneda || sinTc)) return;
    // La base del vínculo se guarda SIEMPRE en la moneda de la factura, para que
    // el ajuste de costo no incluya la diferencia de conversión.
    const base = !mismaMoneda && cotizadoEnFactura !== null ? cotizadoEnFactura : undefined;
    onToggle(it, v, base);
  };


  return (
    <div className="px-3 py-2 flex items-center gap-3 text-body">
      <Checkbox
        checked={checked}
        disabled={!checked && (sinTc || !!errorMoneda)}
        onCheckedChange={(v) => handleToggle(!!v)}
        aria-label={`Vincular ${it.concepto}`}
      />
      <div className="flex-1 min-w-0">
        <Hint label={it.concepto}><div className="truncate">{it.concepto}</div></Hint>
        <div className="text-body-sm text-muted-foreground tabular-nums">
          Cotizado: {formatCurrency(it.monto, it.moneda)}
          {!mismaMoneda && cotizadoEnFactura !== null && factor !== null && (
            <span>
              {" ≈ "}
              <span className="font-medium text-foreground">
                {formatCurrency(cotizadoEnFactura, facturaMoneda)}
              </span>
              {` (T/C DOF ${fmtTc(factor)}`}
              {tcFecha ? ` · ${formatFechaEs(tcFecha)}` : ""}
              {")"}
            </span>
          )}

        </div>
        {errorMoneda && <p className="mt-0.5 text-label text-destructive">{errorMoneda}</p>}
        <VincularConceptoAvisos
          sinTc={sinTc}
          monedaCosto={it.moneda}
          facturaMoneda={facturaMoneda}
          mismaMoneda={mismaMoneda}
          excede={excede}
          cotizadoEnFactura={cotizadoEnFactura}
          implicito={implicito}
          desviado={desviado}
        />
      </div>

      {checked && (
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm text-muted-foreground">{facturaMoneda}</span>
          <MoneyInput
            value={sel.monto}
            onChange={(n: number) => onChangeMonto(it.id, n)}
            disabled={!!errorMoneda}
            aria-invalid={excede || !!errorMoneda || undefined}
            aria-label={`Importe aplicado al concepto ${it.concepto} en ${facturaMoneda}`}
            className={`w-28 h-8 ${excede ? "border-destructive text-destructive" : ""}`}
          />
        </div>
      )}
    </div>
  );
}
