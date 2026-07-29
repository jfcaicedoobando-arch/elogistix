/**
 * Panel lateral con el desglose cotizado vs real de un embarque a nivel de
 * partidas (renglones), invocado desde /compras/conciliacion. Sub-secciones
 * viven en `./ConciliacionDetalleSections` para respetar el techo Power of 10.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../../queryKeys";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  calcularResumen,
  calcularResumenPorEstatus,
  calcularResumenPorMoneda,
  fetchPartidasHuerfanasCount,
  fetchReconciliacionEmbarque,
} from "@/features/embarques/services/reconciliacionCostos";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import { CuerpoTabla, HeaderPanel, ResumenGrid } from "./ConciliacionDetalleSections";

interface Props {
  embarque: EmbarqueConciliacion | null;
  onClose: () => void;
}

export function ConciliacionDetalleSheet({ embarque, onClose }: Props) {
  const navigate = useNavigate();
  const embarqueId = embarque?.embarque_id ?? null;

  const { data: filas = [], isLoading, error, refetch } = useQuery({
    queryKey: compras.conciliacionDetalle(embarqueId),
    queryFn: () => fetchReconciliacionEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });

  const { data: huerfanas = 0 } = useQuery({
    queryKey: compras.conciliacionHuerfanas(embarqueId),
    queryFn: () => fetchPartidasHuerfanasCount(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });

  const resumen = useMemo(() => calcularResumen(filas), [filas]);
  const resumenEstatus = useMemo(() => calcularResumenPorEstatus(filas), [filas]);
  const totalesPorMoneda = useMemo(() => calcularResumenPorMoneda(filas), [filas]);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const monedaResumen = embarque?.moneda ?? filas[0]?.moneda ?? "MXN";

  return (
    <Sheet open={Boolean(embarque)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        {embarque && (
          <>
            <HeaderPanel embarque={embarque} onOpenEmbarque={() => navigate(`/embarques/${embarque.embarque_id}`)} />
            <ResumenGrid
              resumen={resumen}
              resumenEstatus={resumenEstatus}
              huerfanas={huerfanas}
              monedaResumen={monedaResumen}
            />
            <div className="mt-4">
              <CuerpoTabla
                isLoading={isLoading}
                error={error}
                onRetry={() => refetch()}
                filas={filas}
                expandidos={expandidos}
                onToggle={toggle}
                onVincular={(conceptoId) =>
                  navigate(
                    `/compras/por-aprobar?embarque=${encodeURIComponent(embarque.embarque_id)}` +
                    `&concepto=${encodeURIComponent(conceptoId)}`,
                  )
                }
                totalesPorMoneda={totalesPorMoneda}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
