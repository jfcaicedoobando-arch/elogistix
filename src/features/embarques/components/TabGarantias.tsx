/**
 * Tab Garantías — control operativo de depósitos de contenedores por embarque.
 * No es facturable; los depósitos regresan a la empresa al devolver el vacío.
 *
 * v13.89.4: split en sub-componentes (VenceBadge / GarantiasKpiCards /
 * useGarantiasColumns) para cumplir Power of 10 (≤200 líneas).
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { ShieldCheck, RefreshCw } from "lucide-react";
import {
  useGarantiasContenedor,
  useRefrescarGarantiasDesdeTarifa,
} from "@/features/embarques/hooks/useGarantiasContenedor";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { diffDias } from "./garantias/garantiasUtils";
import { GarantiasKpiCards } from "./garantias/GarantiasKpiCards";
import { useGarantiasColumns, type GarantiaRow } from "@/features/embarques/hooks/useGarantiasColumns";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  embarqueId: string;
  canEdit: boolean;
  /** Fecha de llegada real del embarque, usada para prellenar fecha_deposito. */
  fechaLlegadaReal?: string | null;
}

export function TabGarantias({ embarqueId, canEdit, fechaLlegadaReal }: Props) {
  const { data: garantias = [], isLoading } = useGarantiasContenedor(embarqueId);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId);

  const rows: GarantiaRow[] = useMemo(() => {
    const cMap = new Map(contenedores.map(c => [c.id, c]));
    return garantias.map(g => {
      const c = cMap.get(g.embarque_contenedor_id);
      return {
        ...g,
        numero_contenedor: c?.numero_contenedor || '—',
        tipo_contenedor: c?.tipo_contenedor || '—',
      };
    });
  }, [garantias, contenedores]);

  const totalDeposito = rows.reduce((s, r) => s + Number(r.monto_deposito_usd), 0);
  const totalPendiente = rows.filter(r => r.estado === 'pendiente' || r.estado === 'depositado')
    .reduce((s, r) => s + Number(r.monto_deposito_usd), 0);

  const diasPromRecuperacion = useMemo(() => {
    const liberados = rows.filter(r => r.estado === 'liberado' && r.fecha_deposito && r.fecha_liberacion);
    if (liberados.length === 0) return null;
    const suma = liberados.reduce((s, r) => s + diffDias(r.fecha_deposito!, r.fecha_liberacion!), 0);
    return Math.round(suma / liberados.length);
  }, [rows]);

  const { columns } = useGarantiasColumns({ embarqueId, canEdit, fechaLlegadaReal });
  const refrescarMut = useRefrescarGarantiasDesdeTarifa(embarqueId);

  if (isLoading) return <EmptyStateInline loading message="Cargando garantías…" />;

  return (
    <div className="space-y-4">
      <GarantiasKpiCards
        totalDeposito={totalDeposito}
        totalPendiente={totalPendiente}
        count={rows.length}
        diasPromRecuperacion={diasPromRecuperacion}
      />

      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Garantías por contenedor</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Los depósitos no son gasto: regresan al devolver el vacío. Si la naviera tiene carta
              de garantía vigente el monto esperado es 0; si no, captura aquí el monto USD y la
              referencia bancaria del depósito.
            </p>
          </div>
          {canEdit && rows.some((r) => r.estado === "pendiente") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refrescarMut.mutate()}
              disabled={refrescarMut.isPending}
              className="shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refrescarMut.isPending ? "animate-spin" : ""}`} />
              Precargar desde tarifa
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            density="compact"
            tableClassName="w-full"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={ShieldCheck}
                  title="Sin garantías registradas"
                  description="Las garantías se crean automáticamente al agregar contenedores al embarque."
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
