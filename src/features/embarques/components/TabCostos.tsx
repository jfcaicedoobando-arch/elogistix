import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { claseTonoMargen, UMBRAL_MARGEN_OPERATIVO } from "@/lib/ui/margen";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useReconciliacionEmbarque } from "@/features/embarques/hooks/useReconciliacionEmbarque";

import { ConceptosCostoCard } from "./costos/ConceptosCostoCard";
import { AnticiposEmbarqueCard } from "./costos/AnticiposEmbarqueCard";

import type { ConceptoCostoRow } from "@/features/embarques/hooks";

interface Props {
  conceptosCosto: ConceptoCostoRow[];
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
  embarqueId?: string;
  /**
   * B1 (v13.823.395): capacidad ESTRECHA de editar costos/pricing. No es el
   * `canEdit` genérico: coordinador logístico y gerente de operaciones ven los
   * costos pero no capturan ni editan.
   */
  canEditCostos?: boolean;
  /**
   * FIN-01: conceptos en moneda extranjera excluidos de los KPIs por falta de
   * tipo de cambio confiable en el embarque. Se avisa en pantalla; NUNCA se
   * inventa un tipo de cambio ni se mezclan monedas.
   */
  montosSinTipoCambio?: number;
  /** Tasas capturadas en el embarque y usadas para convertir los KPIs a MXN. */
  tipoCambioUsd?: number | null;
  tipoCambioEur?: number | null;
  monedasExtranjeras?: string[];
}

const kpiColors = [
  'border-l-4 border-l-accent',
  'border-l-4 border-l-warning',
  'border-l-4 border-l-success',
  'border-l-4 border-l-info',
];

export function TabCostos({
  conceptosCosto, totalVenta, totalCosto, utilidad, margen, embarqueId, canEditCostos,
  montosSinTipoCambio = 0,
  tipoCambioUsd, tipoCambioEur, monedasExtranjeras = [],
}: Props) {
  const navigate = useNavigate();
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId ?? '');
  const { data: filasReconc = [], isLoading: cargandoCostos } = useReconciliacionEmbarque(embarqueId);

  const showContenedorCol = contenedores.length >= 2;
  const contenedorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    contenedores.forEach(c => map.set(c.id, c.numero_contenedor || `Contenedor ${c.orden}`));
    return map;
  }, [contenedores]);

  const renderContenedor = (id: string | null | undefined) =>
    id ? (contenedorLabelById.get(id) ?? 'General') : <span className="text-muted-foreground">General</span>;

  const kpis = [
    // UI-15: los KPIs de useEmbarqueFinancials ya vienen convertidos a MXN
    // (computeEmbarqueKpis → totalEnMxn); la moneda se pasa explícita para no
    // depender del default de formatCurrency.
    // P2-7: vienen de conceptos de venta/costo (presupuesto), no de facturas de proveedor.
    { label: 'Venta presupuestada', value: formatCurrency(totalVenta, 'MXN'), color: '' },
    { label: 'Costo presupuestado', value: formatCurrency(totalCosto, 'MXN'), color: '' },
    { label: 'Utilidad estimada', value: formatCurrency(utilidad, 'MXN'), color: utilidad >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Margen estimado', value: formatPercent(margen), color: claseTonoMargen(margen, { umbrales: UMBRAL_MARGEN_OPERATIVO }) },
  ];

  const irACargarCostos = canEditCostos && embarqueId
    ? { label: "Cargar costos", onClick: () => navigate(`/embarques/${embarqueId}/editar?step=3`) }
    : undefined;

  return (
    <div className="space-y-6">
      {montosSinTipoCambio > 0 && (
        <Alert variant="warning" data-testid="aviso-sin-tipo-cambio">
          <TriangleAlert className="size-4" />
          <AlertTitle>Totales incompletos por falta de tipo de cambio</AlertTitle>
          <AlertDescription>
            {montosSinTipoCambio} concepto(s) en moneda extranjera (USD/EUR) quedaron
            fuera de estos totales porque el embarque no tiene un tipo de cambio
            válido. Captura el tipo de cambio en los datos del embarque para
            incluirlos.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={kpi.label} className={kpiColors[i]}>
            <CardContent className="p-4">
              <p className="text-body-sm font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-kpi mt-1 tabular-nums ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {monedasExtranjeras.length > 0 && (
        <p className="-mt-4 text-body-sm text-muted-foreground" data-testid="tipo-cambio-kpis">
          Conversión a MXN con el tipo de cambio capturado en el embarque:
          {monedasExtranjeras.includes("USD") && Number(tipoCambioUsd) > 1 && (
            <span className="ml-1 whitespace-nowrap">1 USD = {formatCurrency(Number(tipoCambioUsd), "MXN")}</span>
          )}
          {monedasExtranjeras.includes("EUR") && Number(tipoCambioEur) > 1 && (
            <span className="ml-1 whitespace-nowrap">1 EUR = {formatCurrency(Number(tipoCambioEur), "MXN")}</span>
          )}
          {montosSinTipoCambio > 0 && <span className="ml-1">Los conceptos sin tasa válida se excluyen.</span>}
        </p>
      )}
      <p className="-mt-4 text-body-sm text-muted-foreground" data-testid="nota-kpis-presupuesto">
        Cifras presupuestadas con los conceptos capturados. El costo y la utilidad reales se ven en la conciliación tras capturar las facturas de proveedor.
      </p>

      <ConceptosCostoCard
        filas={filasReconc}
        isLoading={cargandoCostos}
        conceptosCosto={conceptosCosto}
        showContenedorCol={showContenedorCol}
        renderContenedor={renderContenedor}
        irACargarCostos={irACargarCostos}
      />

      <AnticiposEmbarqueCard embarqueId={embarqueId} />
    </div>

  );
}
