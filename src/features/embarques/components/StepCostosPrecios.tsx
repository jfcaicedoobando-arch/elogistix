import { useFormContext } from "react-hook-form";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import { aUSD } from "@/lib/financial/costosUSD";
import { Card, CardContent } from "@/components/ui/card";
import { Hint } from "@/components/shared/Hint";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useTcInicial, type TcInicial } from "@/features/catalogos/hooks/useTcInicial";
import { useCostosPreciosCalc } from "@/features/embarques/hooks/useCostosPreciosCalc";
import { CostosCard, VentasCard } from "./StepCostosPreciosCards";
import { StepCostosTcAviso } from "./StepCostosTcAviso";
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

/** Texto de trazabilidad del T/C precargado (helper puro: baja la complejidad del componente). */
function describirOrigenTc(tc: TcInicial | null | undefined): string | null {
  if (!tc) return null;
  const valor = tc.usdMxn.toFixed(4);
  if (tc.fuente === "DOF") return `DOF del ${formatFechaEs(tc.fecha)} · ${valor}`;
  return `Referencia del día · ${valor}`;
}

/** T/C capturado válido (> 0) o 0 cuando falta/es inválido. */
function tcValido(raw: string | undefined): number {
  const n = parseFloat(raw ?? "");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sin T/C (o moneda sin T/C conocido) mostramos el monto nativo; el banner de aviso fuerza la captura. */
function convertirAUsd(monto: number, moneda: string, tcUSD: number, tcEUR: number): number {
  if (moneda === "USD" || tcUSD <= 0) return monto;
  // BL-15: `aUSD` devuelve null en monedas sin T/C; aquí se muestra el nativo.
  return aUSD(monto, moneda, tcUSD, tcEUR) ?? monto;
}


export function StepCostosPrecios(props: Props) {
  const {
    conceptosVenta, conceptosCosto, proveedoresDb,
    utilidadEstimada: _utilidadEstimada,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    errors = {},
    embarqueId,
  } = props;

  const { watch, register } = useFormContext<EmbarqueFormValues>();
  // FIX-11 (Fase 4): sin fallback silencioso a 1. Cuando falta TC, `toUSD` deja
  // el monto sin convertir y el banner `showTcWarning` fuerza la captura.
  const tcUSD = tcValido(watch('tipoCambioUSD'));
  const tcEUR = tcValido(watch('tipoCambioEUR'));
  const toUSD = (monto: number, moneda: string) => convertirAUsd(monto, moneda, tcUSD, tcEUR);

  const { costoCalc, ventaCalc, costoMixtoIdx, ventaMixtoIdx } =
    useCostosPreciosCalc(conceptosCosto, conceptosVenta, tcUSD, tcEUR);

  const totalCostoUSD = costoCalc.total;
  const totalVentaUSD = ventaCalc.total;
  const tcFaltante = costoCalc.tcMissing || ventaCalc.tcMissing;
  const filasMixtasTotales = costoCalc.filasMixtas.length + ventaCalc.filasMixtas.length;
  const hasErrors = Object.keys(errors).length > 0;
  const showTcWarning = tcFaltante && filasMixtasTotales > 0;
  const utilidadCalculada = totalVentaUSD - totalCostoUSD;

  const { data: contenedoresEmb = [] } = useContenedoresEmbarque(embarqueId ?? '');
  const showContenedorCol = !!embarqueId && contenedoresEmb.length >= 2;

  // Origen del T/C precargado (DOF preferente) para dar trazabilidad al dato.
  const { data: tcInicial } = useTcInicial();
  const tcOrigen = describirOrigenTc(tcInicial);

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
          update={updateConceptoVenta}
          remove={removeConceptoVenta}
          onAdd={addConceptoVenta}
          totalUSD={totalVentaUSD}
          filasMixtasCount={ventaCalc.filasMixtas.length}
        />
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-body-sm text-muted-foreground" id="tc-usd-label">Tipo de Cambio USD</p>
                <Input aria-label="Tipo de Cambio USD" {...register('tipoCambioUSD')} inputMode="decimal" className="text-center mt-1 [appearance:textfield]" />
                <p className="text-label text-muted-foreground mt-1">
                  {tcOrigen ?? "Captura el tipo de cambio del día"}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-muted-foreground" id="tc-eur-label">Tipo de Cambio EUR</p>
                <Input aria-label="Tipo de Cambio EUR" {...register('tipoCambioEUR')} inputMode="decimal" className="text-center mt-1 [appearance:textfield]" />
              </div>
              <div className="min-w-0">
                <p className="text-body-sm text-muted-foreground">Utilidad Estimada (USD)</p>
                <Hint label={formatCurrency(utilidadCalculada, 'USD')}>
                  <p
                    className={`text-kpi mt-2 tabular-nums truncate ${utilidadCalculada >= 0 ? 'text-success' : 'text-destructive'}`}
                  >
                    {formatCurrency(utilidadCalculada, 'USD')}
                  </p>
                </Hint>
              </div>
            </div>
            <StepCostosTcAviso tcInicial={tcInicial} tcUsdCapturado={tcUSD} />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
