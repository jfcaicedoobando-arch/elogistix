/**
 * Controller del componente <TabProformas/>: orquesta el estado UI (delegado a
 * `useTabProformasState`), datos y handlers (descargar PDF, marcar facturada,
 * selección múltiple para convertir N proformas → 1 factura).
 *
 * Las columnas JSX viven en `components/facturacion/proformasColumns.tsx` para
 * respetar la separación lógica/presentación (no JSX en hooks).
 */
import { useCallback, useMemo, useState } from "react";
import { useProformas, type ProformaConFactura, type ProformaRow } from "@/features/embarques/hooks/useProformas";
import { useDescargarProformaPdf } from "@/features/embarques/hooks/useDescargarProformaPdf";
import { useTabProformasState } from "./useTabProformasState";

function isConvertible(p: ProformaConFactura): boolean {
  if ((p.estado_proforma ?? "pendiente") === "facturada") return false;
  return p.estado_cliente === "aceptada";
}


export function useTabProformasController(opts?: {
  isInRange?: (fecha: string | null | undefined) => boolean;
  estadoInicial?: FiltroEstadoProforma;
}) {
  const [proformaAFacturar, setProformaAFacturar] = useState<ProformaRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const { data: proformas = [], isLoading } = useProformas();
  const { descargar, downloadingId } = useDescargarProformaPdf();

  const state = useTabProformasState(proformas, opts?.isInRange, opts?.estadoInicial);
  const {
    filtered, paginated, counts, totalPages,
    search, filtroEstado, filtroCliente, filtroOperador, fechaDesde, fechaHasta,
    page, pageSize, clientesDisponibles, operadoresDisponibles,
  } = state;


  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelected = useCallback(() => setSelectedIds(new Set()), []);

  const selectedProformas = useMemo(
    () => proformas.filter((p) => selectedIds.has(p.id) && isConvertible(p)),
    [proformas, selectedIds],
  );

  // Validación de fusión: mismo cliente (las proformas guardan totales en USD
  // y MXN; la moneda final de la factura la define la serie/conversión y se
  // valida en la RPC `convertir_proformas_a_factura`).
  const fusionInfo = useMemo(() => {
    if (selectedProformas.length === 0) {
      return { sameCliente: true, clienteNombre: "", organizationId: "", diasCredito: null as number | null };
    }
    const first = selectedProformas[0];
    return {
      sameCliente: selectedProformas.every((p) => p.cliente_id === first.cliente_id),
      clienteNombre: first.cliente_nombre,
      organizationId: first.organization_id,
      // v13.331.9 — `null` deja que la RPC herede el plazo de la ficha del
      // cliente; antes se enviaba 0 y la factura vencía el mismo día.
      diasCredito: first.dias_credito ?? null,
    };
  }, [selectedProformas]);

  const csvColumns = [
    { key: "numero", label: "# Proforma" },
    { key: "expediente", label: "Expediente" },
    { key: "cliente", label: "Cliente" },
    { key: "operador", label: "Operador" },
    { key: "dias_credito", label: "Días Crédito" },
    { key: "subtotal_usd", label: "Subtotal USD" },
    { key: "iva_usd", label: "IVA USD" },
    { key: "total_usd", label: "Total USD" },
    { key: "subtotal_mxn", label: "Subtotal MXN" },
    { key: "iva_mxn", label: "IVA MXN" },
    { key: "total_mxn", label: "Total MXN" },
    { key: "fecha", label: "Fecha" },
    { key: "estado", label: "Estado" },
    { key: "folio_factura", label: "Folio Factura" },
    { key: "fecha_facturacion", label: "Fecha Facturación" },
  ];

  const csvRows = () => filtered.map((p) => ({
    numero: p.numero, expediente: p.expediente, cliente: p.cliente_nombre,
    operador: p.operador ?? "", dias_credito: p.dias_credito ?? "",
    subtotal_usd: Number(p.subtotal_usd), iva_usd: Number(p.iva_usd), total_usd: Number(p.total_usd),
    subtotal_mxn: Number(p.subtotal_mxn), iva_mxn: Number(p.iva_mxn), total_mxn: Number(p.total_mxn),
    fecha: p.fecha_emision, estado: p.estado_proforma ?? "pendiente",
    folio_factura: p.folio_factura_externa ?? "", fecha_facturacion: p.fecha_facturacion ?? "",
  }));

  return {
    // estado UI — filtros
    search, filtroEstado, filtroCliente, filtroOperador, fechaDesde, fechaHasta,
    page, pageSize,
    setSearch: state.setSearch,
    setFiltroEstado: state.setFiltroEstado,
    setFiltroCliente: state.setFiltroCliente,
    setFiltroOperador: state.setFiltroOperador,
    setFechaDesde: state.setFechaDesde,
    setFechaHasta: state.setFechaHasta,
    clearFiltros: state.clearAll,
    setPage: state.setPage,
    setPageSize: state.setPageSize,
    // opciones de filtros derivadas del dataset
    clientesDisponibles, operadoresDisponibles,
    // datos

    isLoading, proformas, filtered, paginated, counts, totalPages,
    // handlers para columnas (compuestas en el componente)
    descargar, downloadingId,
    // selección múltiple (Fase 3 — fusión)
    selectedIds, toggleSelected, clearSelected, isConvertible,
    selectedProformas, fusionInfo,
    // export CSV
    csvColumns, csvRows,
    // dialog facturación (flujo legado)
    proformaAFacturar, setProformaAFacturar,
  };
}
