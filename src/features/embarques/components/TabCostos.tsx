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
    { label: 'Total Venta', value: formatCurrency(totalVenta, 'MXN'), color: '' },
    { label: 'Total Costo', value: formatCurrency(totalCosto, 'MXN'), color: '' },
    { label: 'Utilidad', value: formatCurrency(utilidad, 'MXN'), color: utilidad >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Margen', value: formatPercent(margen), color: claseTonoMargen(margen, { umbrales: UMBRAL_MARGEN_OPERATIVO }) },
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
