import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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
  canEdit?: boolean;
}

const kpiColors = [
  'border-l-4 border-l-accent',
  'border-l-4 border-l-warning',
  'border-l-4 border-l-success',
  'border-l-4 border-l-info',
];

export function TabCostos({ conceptosCosto, totalVenta, totalCosto, utilidad, margen, embarqueId, canEdit }: Props) {
  const navigate = useNavigate();
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId ?? '');
  const { data: filasReconc = [] } = useReconciliacionEmbarque(embarqueId);

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

  const irACargarCostos = canEdit && embarqueId
    ? { label: "Cargar costos", onClick: () => navigate(`/embarques/${embarqueId}/editar?step=3`) }
    : undefined;

  return (
    <div className="space-y-6">
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
        conceptosCosto={conceptosCosto}
        showContenedorCol={showContenedorCol}
        renderContenedor={renderContenedor}
        irACargarCostos={irACargarCostos}
      />

      <AnticiposEmbarqueCard embarqueId={embarqueId} />
    </div>

  );
}
