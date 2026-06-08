import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { formatCurrency } from "@/lib/formatters";
import { aUSD, sumarEnMoneda } from "@/lib/financial/costosUSD";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import { FilaCostoPrecio } from "@/features/embarques/components/conceptos/FilaCostoPrecio";
import { FilaVentaPrecio } from "@/features/embarques/components/conceptos/FilaVentaPrecio";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { ConceptoVentaLocal as ConceptoVentaRow, ConceptoCostoLocal as ConceptoCostoRow } from "@/types/concepto";

/** Moneda objetivo (bucket) del wizard de embarques: todos los totales viven en USD. */
const TARGET_MONEDA = 'USD' as const;

interface Proveedor {
  id: string;
  nombre: string;
}

interface Props {
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  proveedoresDb: Proveedor[];
  subtotalVenta: number;
  totalCosto: number;
  utilidadEstimada: number;
  updateConceptoVenta: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean | null) => void;
  addConceptoVenta: () => void;
  removeConceptoVenta: (id: number) => void;
  updateConceptoCosto: (id: number, field: keyof ConceptoCostoRow, value: string | number | boolean | null) => void;
  addConceptoCosto: () => void;
  removeConceptoCosto: (id: number) => void;
  errors?: StepValidationErrors;
  /** Sólo presente al editar un embarque existente. Habilita la columna "Contenedor". */
  embarqueId?: string;
}

export function StepCostosPrecios(props: Props) {
  const {
    conceptosVenta, conceptosCosto, proveedoresDb,
    utilidadEstimada,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    errors = {},
    embarqueId,
  } = props;

  const { watch, register } = useFormContext<EmbarqueFormValues>();
  const tipoCambioUSD = watch('tipoCambioUSD');
  const tipoCambioEUR = watch('tipoCambioEUR');

  const tcUSD = parseFloat(tipoCambioUSD) || 1;
  const tcEUR = parseFloat(tipoCambioEUR) || 1;

  const toUSD = (monto: number, moneda: string) => aUSD(monto, moneda, tcUSD, tcEUR);

  // Suma estricta con detección de filas en moneda distinta al target USD.
  // Si falta TC con filas mixtas, sumarEnMoneda lanza — capturamos y caemos a
  // un cálculo laxo para no romper el render, y mostramos un alert.
  const costoCalc = useMemo(() => {
    const items = conceptosCosto.map(c => ({ monto: c.monto, moneda: c.moneda }));
    try {
      return { ...sumarEnMoneda(items, TARGET_MONEDA, tcUSD, tcEUR), tcMissing: false };
    } catch {
      return { total: 0, filasMixtas: items.map((it, index) => ({ index, moneda: it.moneda })).filter(f => f.moneda !== TARGET_MONEDA), homogenea: false, tcMissing: true };
    }
  }, [conceptosCosto, tcUSD, tcEUR]);

  const ventaCalc = useMemo(() => {
    const items = conceptosVenta.map(v => ({ monto: v.precioUnitario, moneda: v.moneda }));
    try {
      return { ...sumarEnMoneda(items, TARGET_MONEDA, tcUSD, tcEUR), tcMissing: false };
    } catch {
      return { total: 0, filasMixtas: items.map((it, index) => ({ index, moneda: it.moneda })).filter(f => f.moneda !== TARGET_MONEDA), homogenea: false, tcMissing: true };
    }
  }, [conceptosVenta, tcUSD, tcEUR]);

  const totalCostoUSD = costoCalc.total;
  const totalVentaUSD = ventaCalc.total;
  const tcFaltante = costoCalc.tcMissing || ventaCalc.tcMissing;
  const filasMixtasTotales = costoCalc.filasMixtas.length + ventaCalc.filasMixtas.length;

  const costoMixtoIdx = useMemo(
    () => new Set(costoCalc.filasMixtas.map(f => f.index)),
    [costoCalc.filasMixtas],
  );
  const ventaMixtoIdx = useMemo(
    () => new Set(ventaCalc.filasMixtas.map(f => f.index)),
    [ventaCalc.filasMixtas],
  );

  const hasErrors = Object.keys(errors).length > 0;

  // Sólo en edición: si el embarque tiene ≥2 contenedores, mostramos columna extra.
  const { data: contenedoresEmb = [] } = useContenedoresEmbarque(embarqueId ?? '');
  const showContenedorCol = !!embarqueId && contenedoresEmb.length >= 2;

  const costoCols = showContenedorCol
    ? "grid-cols-[1fr_1fr_120px_90px_140px_110px_40px]"
    : "grid-cols-[1fr_1fr_120px_90px_110px_40px]";
  const ventaCols = showContenedorCol
    ? "grid-cols-[1fr_80px_120px_90px_140px_110px_40px]"
    : "grid-cols-[1fr_80px_120px_90px_110px_40px]";

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      {hasErrors && <ValidationAlert severity="error" errors={errors} />}
      {tcFaltante && filasMixtasTotales > 0 && (
        <ValidationAlert
          severity="warning"
          errors={{ tipoCambio: `Falta tipo de cambio para convertir ${filasMixtasTotales} fila(s) en moneda extranjera. Captura el TC USD/EUR antes de continuar.` }}
        />
      )}
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className={`grid ${costoCols} gap-2 text-xs font-medium text-muted-foreground`}>
              <span>Proveedor</span><span>Concepto</span><span>Subtotal (sin IVA)</span><span>Moneda</span>
              {showContenedorCol && <span>Contenedor</span>}
              <span>Total USD</span><span></span>
            </div>
            {conceptosCosto.map((costo, idx) => (
              <FilaCostoPrecio
                key={costo.id}
                costo={costo}
                totalUSD={toUSD(costo.monto, costo.moneda)}
                esMixta={costoMixtoIdx.has(idx)}
                proveedoresDb={proveedoresDb}
                cols={costoCols}
                showContenedorCol={showContenedorCol}
                embarqueId={embarqueId}
                tcUSD={tcUSD}
                tcEUR={tcEUR}
                disableRemove={conceptosCosto.length <= 1}
                update={updateConceptoCosto}
                remove={removeConceptoCosto}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addConceptoCosto}>+ Agregar costo</Button>
            <div className="border-t pt-3 mt-3 text-sm text-right">
              <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(totalCostoUSD, 'USD')}</span></div>
              {costoCalc.filasMixtas.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {costoCalc.filasMixtas.length} fila(s) convertida(s) a USD con TC vigente.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className={`grid ${ventaCols} gap-2 text-xs font-medium text-muted-foreground`}>
              <span>Concepto</span><span>Cantidad</span><span>Subtotal (sin IVA)</span><span>Moneda</span>
              {showContenedorCol && <span>Contenedor</span>}
              <span>Total USD</span><span></span>
            </div>
            {conceptosVenta.map((venta, idx) => (
              <FilaVentaPrecio
                key={venta.id}
                venta={venta}
                totalUSD={toUSD(venta.precioUnitario, venta.moneda)}
                esMixta={ventaMixtoIdx.has(idx)}
                cols={ventaCols}
                showContenedorCol={showContenedorCol}
                embarqueId={embarqueId}
                tcUSD={tcUSD}
                tcEUR={tcEUR}
                disableRemove={conceptosVenta.length <= 1}
                update={updateConceptoVenta}
                remove={removeConceptoVenta}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addConceptoVenta}>+ Agregar concepto</Button>
            <div className="border-t pt-3 mt-3 text-sm text-right">
              <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(totalVentaUSD, 'USD')}</span></div>
              {ventaCalc.filasMixtas.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {ventaCalc.filasMixtas.length} fila(s) convertida(s) a USD con TC vigente.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Tipo de Cambio USD</p><Input type="number" {...register('tipoCambioUSD')} className="text-center mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Tipo de Cambio EUR</p><Input type="number" {...register('tipoCambioEUR')} className="text-center mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Utilidad Estimada (USD)</p><p className={`text-xl font-bold mt-2 ${utilidadEstimada >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(totalVentaUSD - totalCostoUSD, 'USD')}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
