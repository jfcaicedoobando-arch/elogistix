/**
 * Hook controller para `pages/admin/Idempotencia.tsx`. Encapsula la lectura
 * del log de idempotencia y el filtro por función. Extraído en v12.95.10
 * (Auditoría Paso 3).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listIdempotencyLog, type IdempotenciaRow } from "@/services/admin";
import { queryKeys } from "@/lib/query";

export type FnFilter =
  | "todos"
  | "crear_embarque_completo"
  | "duplicar_embarque_completo"
  | "consolidar_proformas"
  | "marcar_proforma_facturada"
  | "actualizar_embarque_completo"
  | "avanzar_estado_embarque"
  | "actualizar_cotizacion_costos"
  | "upload_documento_embarque";

export function useIdempotenciaLog(enabled: boolean) {
  const [filtroFn, setFiltroFn] = useState<FnFilter>("todos");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.idempotenciaLog,
    queryFn: () => listIdempotencyLog(200, 0),
    enabled,
  });

  const rows: IdempotenciaRow[] = (data ?? []).filter(
    (r) => filtroFn === "todos" || r.fn === filtroFn,
  );

  const totalCreados = rows.filter((r) => !r.pending && r.hits === 0).length;
  const totalCacheados = rows.filter((r) => !r.pending && r.hits > 0).length;
  const totalDuplicadosBloqueados = rows.reduce((s, r) => s + r.hits, 0);

  return {
    filtroFn,
    setFiltroFn,
    rows,
    isLoading,
    isFetching,
    refetch,
    totales: { totalCreados, totalCacheados, totalDuplicadosBloqueados },
  };
}
