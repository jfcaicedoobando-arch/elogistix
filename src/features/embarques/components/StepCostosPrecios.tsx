import { useFormContext } from "react-hook-form";
import { formatCurrency } from "@/lib/formatters";
import { aUSD } from "@/lib/financial/costosUSD";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import { FilaCostoPrecio } from "@/features/embarques/components/conceptos/FilaCostoPrecio";
import { FilaVentaPrecio } from "@/features/embarques/components/conceptos/FilaVentaPrecio";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useCostosPreciosCalc } from "@/features/embarques/hooks/useCostosPreciosCalc";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { ConceptoVentaLocal as ConceptoVentaRow, ConceptoCostoLocal as ConceptoCostoRow } from "@/types/concepto";

interface Proveedor { id: string; nombre: string }

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

const COSTO_COLS_BASE = "grid-cols-[1fr_1fr_120px_90px_110px_40px]";
const COSTO_COLS_CONT = "grid-cols-[1fr_1fr_120px_90px_140px_110px_40px]";
const VENTA_COLS_BASE = "grid-cols-[1fr_80px_120px_90px_110px_40px]";
const VENTA_COLS_CONT = "grid-cols-[1fr_80px_120px_90px_140px_110px_40px]";

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
  const tcUSD = parseFloat(watch('tipoCambioUSD')) || 1;
  const tcEUR = parseFloat(watch('tipoCambioEUR')) || 1;
  const toUSD = (monto: number, moneda: string) => aUSD(monto, moneda, tcUSD, tcEUR);

  const { costoCalc, ventaCalc, costoMixtoIdx, ventaMixtoIdx } =
    useCostosPreciosCalc(conceptosCosto, conceptosVenta, tcUSD, tcEUR);

  const totalCostoUSD = costoCalc.total;
  const totalVentaUSD = ventaCalc.total;
  const tcFaltante = costoCalc.tcMissing || ventaCalc.tcMissing;
  const filasMixtasTotales = costoCalc.filasMixtas.length + ventaCalc.filasMixtas.length;
  const hasErrors = Object.keys(errors).length > 0;
  const showTcWarning = tcFaltante && filasMixtasTotales > 0;

  // Sólo en edición: si el embarque tiene ≥2 contenedores, mostramos columna extra.
  const { data: contenedoresEmb = [] } = useContenedoresEmbarque(embarqueId ?? '');
  const showContenedorCol = !!embarqueId && contenedoresEmb.length >= 2;

  const costoCols = showContenedorCol ? COSTO_COLS_CONT : COSTO_COLS_BASE;
  const ventaCols = showContenedorCol ? VENTA_COLS_CONT : VENTA_COLS_BASE;


  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      {hasErrors && <ValidationAlert severity="error" errors={errors} />}
      {showTcWarning && (
        <ValidationAlert
          severity="warning"
          errors={{ tipoCambio: `Falta tipo de cambio para convertir ${filasMixtasTotales} fila(s) en moneda extranjera. Captura el TC USD/EUR antes de continuar.` }}
        />
      )}
      <CostosCard
        cols={costoCols}
        showContenedorCol={showContenedorCol}
        conceptos={conceptosCosto}
        toUSD={toUSD}
        mixtoIdx={costoMixtoIdx}
        proveedoresDb={proveedoresDb}
        embarqueId={embarqueId}
        tcUSD={tcUSD}
        tcEUR={tcEUR}
        update={updateConceptoCosto}
        remove={removeConceptoCosto}
        onAdd={addConceptoCosto}
        totalUSD={totalCostoUSD}
        filasMixtasCount={costoCalc.filasMixtas.length}
      />
      <VentasCard
        cols={ventaCols}
        showContenedorCol={showContenedorCol}
        conceptos={conceptosVenta}
        toUSD={toUSD}
        mixtoIdx={ventaMixtoIdx}
        embarqueId={embarqueId}
        tcUSD={tcUSD}
        tcEUR={tcEUR}
        update={updateConceptoVenta}
        remove={removeConceptoVenta}
        onAdd={addConceptoVenta}
        totalUSD={totalVentaUSD}
        filasMixtasCount={ventaCalc.filasMixtas.length}
      />
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

interface CostosCardProps {
  cols: string;
  showContenedorCol: boolean;
  conceptos: ConceptoCostoRow[];
  toUSD: (m: number, mo: string) => number;
  mixtoIdx: Set<number>;
  proveedoresDb: Proveedor[];
  embarqueId?: string;
  tcUSD: number;
  tcEUR: number;
  update: (id: number, field: keyof ConceptoCostoRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
  onAdd: () => void;
  totalUSD: number;
  filasMixtasCount: number;
}

function CostosCard(p: CostosCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className={`grid ${p.cols} gap-2 text-xs font-medium text-muted-foreground`}>
            <span>Proveedor</span><span>Concepto</span><span>Subtotal (sin IVA)</span><span>Moneda</span>
            {p.showContenedorCol && <span>Contenedor</span>}
            <span>Total USD</span><span></span>
          </div>
          {p.conceptos.map((costo, idx) => (
            <FilaCostoPrecio
              key={costo.id}
              costo={costo}
              totalUSD={p.toUSD(costo.monto, costo.moneda)}
              esMixta={p.mixtoIdx.has(idx)}
              proveedoresDb={p.proveedoresDb}
              cols={p.cols}
              showContenedorCol={p.showContenedorCol}
              embarqueId={p.embarqueId}
              tcUSD={p.tcUSD}
              tcEUR={p.tcEUR}
              disableRemove={p.conceptos.length <= 1}
              update={p.update}
              remove={p.remove}
            />
          ))}
          <Button variant="outline" size="sm" onClick={p.onAdd}>+ Agregar costo</Button>
          <div className="border-t pt-3 mt-3 text-sm text-right">
            <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(p.totalUSD, 'USD')}</span></div>
            {p.filasMixtasCount > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {p.filasMixtasCount} fila(s) convertida(s) a USD con TC vigente.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface VentasCardProps {
  cols: string;
  showContenedorCol: boolean;
  conceptos: ConceptoVentaRow[];
  toUSD: (m: number, mo: string) => number;
  mixtoIdx: Set<number>;
  embarqueId?: string;
  tcUSD: number;
  tcEUR: number;
  update: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
  onAdd: () => void;
  totalUSD: number;
  filasMixtasCount: number;
}

function VentasCard(p: VentasCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className={`grid ${p.cols} gap-2 text-xs font-medium text-muted-foreground`}>
            <span>Concepto</span><span>Cantidad</span><span>Subtotal (sin IVA)</span><span>Moneda</span>
            {p.showContenedorCol && <span>Contenedor</span>}
            <span>Total USD</span><span></span>
          </div>
          {p.conceptos.map((venta, idx) => (
            <FilaVentaPrecio
              key={venta.id}
              venta={venta}
              totalUSD={p.toUSD(venta.precioUnitario, venta.moneda)}
              esMixta={p.mixtoIdx.has(idx)}
              cols={p.cols}
              showContenedorCol={p.showContenedorCol}
              embarqueId={p.embarqueId}
              tcUSD={p.tcUSD}
              tcEUR={p.tcEUR}
              disableRemove={p.conceptos.length <= 1}
              update={p.update}
              remove={p.remove}
            />
          ))}
          <Button variant="outline" size="sm" onClick={p.onAdd}>+ Agregar concepto</Button>
          <div className="border-t pt-3 mt-3 text-sm text-right">
            <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(p.totalUSD, 'USD')}</span></div>
            {p.filasMixtasCount > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {p.filasMixtasCount} fila(s) convertida(s) a USD con TC vigente.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
