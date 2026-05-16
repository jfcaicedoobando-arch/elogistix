/**
 * Controller del componente <TabProformasPendientes/>: encapsula la selección,
 * agrupación, totales y los handlers de aprobación/consolidación.
 */
import { useMemo, useState } from "react";
import {
  useProformasPendientes,
  useAprobarProformas,
  useConsolidarProformas,
  type ProformaPendienteConEmbarque,
} from "@/hooks/embarque/useProformas";
import { useTasaIVA } from "@/hooks/catalogos/useTasaIVA";
import { useStableRequestId } from "@/lib/idempotency";
import {
  agruparProformasPendientes,
  totalesProformasSeleccionadas,
} from "@/lib/domain/proforma";

export function useTabProformasPendientesController() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: proformas = [], isLoading } = useProformasPendientes();
  const aprobar = useAprobarProformas();
  const consolidar = useConsolidarProformas();
  const tasaIva = useTasaIVA();
  const reqId = useStableRequestId();

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter((p) =>
      p.expediente.toLowerCase().includes(q) ||
      p.cliente_nombre.toLowerCase().includes(q) ||
      (p.bl_master ?? "").toLowerCase().includes(q) ||
      (p.embarques?.bl_master ?? "").toLowerCase().includes(q) ||
      p.numero.toLowerCase().includes(q),
    );
  }, [proformas, search]);

  const grupos = useMemo(
    () => agruparProformasPendientes<ProformaPendienteConEmbarque>(filtradas),
    [filtradas],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCollapse = (expediente: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(expediente)) next.delete(expediente); else next.add(expediente);
      return next;
    });
  };

  const seleccionPorExpediente = useMemo(() => {
    const map = new Map<string, ProformaPendienteConEmbarque[]>();
    for (const g of grupos) {
      const sel = g.proformas.filter((p) => selectedIds.has(p.id));
      if (sel.length > 0) map.set(g.expediente, sel);
    }
    return map;
  }, [grupos, selectedIds]);

  const totalesSeleccion = useMemo(
    () => totalesProformasSeleccionadas(proformas, selectedIds),
    [proformas, selectedIds],
  );

  const totalSeleccionadas = selectedIds.size;
  const expedientesEnSeleccion = seleccionPorExpediente.size;
  const puedeConsolidar = totalSeleccionadas >= 2 && expedientesEnSeleccion === 1;
  const puedeAprobar = totalSeleccionadas >= 1;

  const handleConsolidar = () => {
    if (!puedeConsolidar) return;
    const [expediente, sel] = Array.from(seleccionPorExpediente.entries())[0];
    const grupo = grupos.find((g) => g.expediente === expediente);
    if (!grupo) return;
    consolidar.mutate(
      {
        proformaIds: sel.map((p) => p.id),
        embarqueId: grupo.embarqueId,
        clienteId: grupo.clienteId,
        clienteNombre: grupo.clienteNombre,
        expediente: grupo.expediente,
        blMaster: grupo.blMaster,
        operador: grupo.operador,
        diasCredito: grupo.diasCredito,
        tasaIva,
      },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  };

  const handleAprobar = () => {
    if (!puedeAprobar) return;
    aprobar.mutate(
      { proformaIds: Array.from(selectedIds) },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  };

  return {
    search, setSearch,
    selectedIds, collapsed,
    isLoading, grupos,
    toggleSelect, toggleCollapse,
    totalesSeleccion, totalSeleccionadas, expedientesEnSeleccion,
    puedeConsolidar, puedeAprobar,
    handleConsolidar, handleAprobar,
    isAprobarPending: aprobar.isPending,
    isConsolidarPending: consolidar.isPending,
  };
}
