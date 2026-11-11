import type { EmbarqueRow } from "@/features/embarques/types/embarque";
import { useEmbarqueFinancials } from "./useEmbarqueFinancials";
import {
  useEmbarqueConceptosDetalle,
  useEmbarqueDocumentosDetalle,
  useEmbarqueFacturasDetalle,
  useEmbarqueNotasDetalle,
} from "./useEmbarqueDetalleSecciones";

const SIN_FILAS: never[] = [];

export function useEmbarqueDetalleTabsData(embarque: EmbarqueRow, activeTab: string) {
  const necesitaConceptos = activeTab === "costos" || activeTab === "pnl";
  const necesitaDocumentos = activeTab === "documentos" || activeTab === "cierre";
  const conceptos = useEmbarqueConceptosDetalle(embarque.id, necesitaConceptos);
  const documentos = useEmbarqueDocumentosDetalle(embarque.id, necesitaDocumentos);
  const facturas = useEmbarqueFacturasDetalle(embarque.id, activeTab === "facturacion");
  const notas = useEmbarqueNotasDetalle(embarque.id, activeTab === "notas");
  const conceptosVenta = conceptos.conceptosVenta ?? SIN_FILAS;
  const conceptosCosto = conceptos.conceptosCosto ?? SIN_FILAS;
  const financials = useEmbarqueFinancials({
    conceptosVenta, conceptosCosto,
    tipoCambioUSD: embarque.tipo_cambio_usd ?? 1,
    tipoCambioEUR: embarque.tipo_cambio_eur ?? 1,
  });
  const activeQuery = {
    costos: conceptos, pnl: conceptos,
    documentos, cierre: documentos, facturacion: facturas, notas,
  };
  return {
    conceptosVenta, conceptosCosto, financials,
    documentos: documentos.data ?? SIN_FILAS,
    facturas: facturas.data ?? SIN_FILAS,
    notas: notas.data ?? SIN_FILAS,
    query: activeQuery[activeTab as keyof typeof activeQuery],
  };
}
