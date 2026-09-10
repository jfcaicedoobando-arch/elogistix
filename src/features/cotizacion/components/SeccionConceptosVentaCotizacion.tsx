import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardSection } from "@/components/shared/WizardSection";
import { AlertTriangle, Plus } from "lucide-react";

import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import { formatCurrency } from "@/lib/formatters";
import { useTasaIVA } from "@/features/catalogos/hooks";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { detectarFilasMixtas } from "@/lib/financial/costosUSD";
import { etiquetaTasaIva } from "@/lib/financial/etiquetaTasaIva";
import { ConceptoRowUSD, ConceptoRowMXN } from "./conceptos/ConceptoRows";
import { AgregarConceptoInline } from "./wizard/AgregarConceptoInline";

interface Props {
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  actualizarConceptoUSD: (index: number, campo: string, valor: string | number | boolean) => void;
  actualizarConceptoMXN: (index: number, campo: string, valor: string | number | boolean) => void;
  agregarConceptoUSD: () => void;
  agregarConceptoMXN: () => void;
  /** P2 cierre (v13.296.0) — inserta con datos precargados desde el popover. */
  agregarConceptoPrefill?: (moneda: "USD" | "MXN", prefill: Partial<ConceptoVentaCotizacion>) => void;
  eliminarConceptoUSD: (index: number) => void;
  eliminarConceptoMXN: (index: number) => void;
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

export default function SeccionConceptosVentaCotizacion({
  conceptosUSD, conceptosMXN,
  actualizarConceptoUSD, actualizarConceptoMXN,
  agregarConceptoUSD, agregarConceptoMXN, agregarConceptoPrefill,
  eliminarConceptoUSD, eliminarConceptoMXN,
  totalUSD, subtotalMXN, ivaMXN, totalMXN,
}: Props) {
  const tasaIva = useTasaIVA();
  const hayIvaUSD = conceptosUSD.some(c => c.aplica_iva);
  // P2-6.3: la nota de IVA se calcula con la tasa vigente y sólo se muestra
  // cuando algún concepto realmente causa IVA (antes decía "16%" siempre).
  // R7-FIX2: la etiqueta sale de las tasas reales de las filas (8% frontera,
  // mixtas 8/16%) en lugar de imprimir siempre la tasa global de la org.
  const tasaPctMXN = etiquetaTasaIva(conceptosMXN, tasaIva);
  const hayIvaMXN = conceptosMXN.some(c => c.aplica_iva) || ivaMXN > 0;
  const subtotalSinIvaUSD = sumarSubtotales(conceptosUSD, (c) => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario }));
  const ivaUSD = totalUSD - subtotalSinIvaUSD;
  // Asersión de paridad fila ↔ bucket: cada bucket impone una moneda objetivo.
  // Una fila con `moneda` distinta indica datos inconsistentes (los buckets
  // suman natively, no aplican FX automático). Mostramos un indicador visible.
  const mixtasUSD = detectarFilasMixtas(conceptosUSD, 'USD');
  const mixtasMXN = detectarFilasMixtas(conceptosMXN, 'MXN');

  return (
    <div className="space-y-6">
      <WizardSection
        title="Conceptos en USD"
        contentClassName="space-y-3"
        actions={
          agregarConceptoPrefill ? (
            <AgregarConceptoInline
              monedaFija="USD"
              triggerLabel="Agregar"
              onAgregar={agregarConceptoPrefill}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={agregarConceptoUSD}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )
        }
      >
        <>
          {mixtasUSD.length > 0 && (
            <Alert variant="warning" data-testid="bucket-mixed-warning-usd">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Hay {mixtasUSD.length} fila(s) con moneda distinta a USD ({mixtasUSD.map(f => `#${f.index + 1}: ${f.moneda}`).join(', ')}).
                Este bucket suma en moneda nativa: ajusta la moneda de la fila o muévela al bucket MXN.
              </AlertDescription>
            </Alert>
          )}

          {conceptosUSD.map((c, i) => (
            <ConceptoRowUSD
              key={i}
              concepto={c}
              index={i}
              total={conceptosUSD.length}
              actualizar={actualizarConceptoUSD}
              eliminar={eliminarConceptoUSD}
            />
          ))}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            {hayIvaUSD ? (
              <>
                <span className="text-body">Subtotal s/IVA: {formatCurrency(subtotalSinIvaUSD, 'USD')}</span>
                <span className="text-body text-warning">IVA {etiquetaTasaIva(conceptosUSD, tasaIva)}: {formatCurrency(ivaUSD, 'USD')}</span>
                <span className="text-body font-semibold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
              </>
            ) : (
              <span className="text-body font-semibold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
            )}
          </div>
        </>
      </WizardSection>

      <WizardSection
        title="Conceptos en MXN + IVA"
        contentClassName="space-y-3"
        actions={
          agregarConceptoPrefill ? (
            <AgregarConceptoInline
              monedaFija="MXN"
              triggerLabel="Agregar"
              onAgregar={agregarConceptoPrefill}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={agregarConceptoMXN}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )
        }
      >
        <>
          {mixtasMXN.length > 0 && (
            <Alert variant="warning" data-testid="bucket-mixed-warning-mxn">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Hay {mixtasMXN.length} fila(s) con moneda distinta a MXN ({mixtasMXN.map(f => `#${f.index + 1}: ${f.moneda}`).join(', ')}).
                Ajusta la moneda o mueve la fila al bucket USD para evitar mezcla.
              </AlertDescription>
            </Alert>
          )}
          {conceptosMXN.map((c, i) => (
            <ConceptoRowMXN
              key={i}
              concepto={c}
              index={i}
              total={conceptosMXN.length}
              actualizar={actualizarConceptoMXN}
              eliminar={eliminarConceptoMXN}
              tasaIva={tasaIva}
            />
          ))}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            <span className="text-body">Subtotal MXN: {formatCurrency(subtotalMXN, 'MXN')}</span>
            <span className="text-body">IVA ({tasaPctMXN}): {formatCurrency(ivaMXN, 'MXN')}</span>
            <span className="text-body font-semibold">Total MXN: {formatCurrency(totalMXN, 'MXN')}</span>
          </div>
        </>
      </WizardSection>


      <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
        <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
        <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
        {hayIvaMXN && (
          <span className="text-body-sm text-muted-foreground">* Los conceptos en MXN incluyen IVA {tasaPctMXN}</span>
        )}
        {!hayIvaMXN && !hayIvaUSD && (
          <span className="text-body-sm text-muted-foreground">* Ningún concepto causa IVA</span>
        )}
        {hayIvaUSD && <span className="text-body-sm text-warning">* Algunos conceptos USD incluyen IVA {etiquetaTasaIva(conceptosUSD, tasaIva)}</span>}
      </div>
    </div>
  );
}
