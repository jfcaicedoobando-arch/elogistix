/**
 * Controller del componente <TabProformas/>: orquesta el estado UI (delegado a
 * `useTabProformasState`), datos y handlers (descargar PDF, marcar facturada).
 *
 * Las columnas JSX viven en `components/facturacion/proformasColumns.tsx` para
 * respetar la separación lógica/presentación (no JSX en hooks).
 */
import { useState } from "react";
import { useProformas, type ProformaRow } from "@/hooks/embarque/useProformas";
import { useDescargarProformaPdf } from "@/hooks/embarque/useDescargarProformaPdf";
import { useTabProformasState, type FiltroEstadoProforma } from "./useTabProformasState";

export type { FiltroEstadoProforma };

export function useTabProformasController() {
  const [proformaAFacturar, setProformaAFacturar] = useState<ProformaRow | null>(null);

  const { data: proformas = [], isLoading } = useProformas();
  const { descargar, downloadingId } = useDescargarProformaPdf();

  const state = useTabProformasState(proformas);
  const { filtered, paginated, counts, totalPages, search, filtroEstado, page, pageSize } = state;

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
    // estado UI
    search, filtroEstado, page, pageSize,
    setSearch: state.setSearch,
    setFiltroEstado: state.setFiltroEstado,
    setPage: state.setPage,
    setPageSize: state.setPageSize,
    // datos
    isLoading, proformas, filtered, paginated, counts, totalPages,
    // handlers para columnas (compuestas en el componente)
    descargar, downloadingId,
    // export CSV
    csvColumns, csvRows,
    // dialog facturación
    proformaAFacturar, setProformaAFacturar,
  };
}
