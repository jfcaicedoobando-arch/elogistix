/**
 * Tipos derivados para `EmbarqueDetalleTabs` — extraídos en v13.182.0
 * (Wave 2 · Power-of-10 splits).
 */
import type { ComponentProps } from "react";
import type { TabResumen } from "@/features/embarques/components/TabResumen";
import type { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
import type { TabCostos } from "@/features/embarques/components/TabCostos";
import type { TabFacturacion } from "@/features/embarques/components/TabFacturacion";
import type { TabNotas } from "@/features/embarques/components/TabNotas";
import type { TabTracking } from "@/features/embarques/components/TabTracking";

// Tipos derivados de los hijos para no duplicar contratos ni recurrir a `any`.
export type ResumenProps = ComponentProps<typeof TabResumen>;
export type DocsProps = ComponentProps<typeof TabDocumentos>;
export type CostosProps = ComponentProps<typeof TabCostos>;
export type FacturacionProps = ComponentProps<typeof TabFacturacion>;
export type NotasProps = ComponentProps<typeof TabNotas>;
export type TrackingProps = ComponentProps<typeof TabTracking>;

export type DocHandlers = Pick<
  DocsProps,
  "uploadingDocId" | "downloadingDocId" | "deletingDocId" | "togglingNoAplicaDocId"
  | "onUpload" | "onDownload" | "onDelete" | "onToggleNoAplica"
>;

export interface Financials {
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
}

// El embarque debe satisfacer simultáneamente los contratos de TabResumen,
// TabFacturacion y TabTracking, además de exponer los campos que esta vista
// consume directamente (expediente, created_by_email, created_at).
export type EmbarqueProp = ResumenProps["embarque"]
  & FacturacionProps["embarque"]
  & TrackingProps["embarque"]
  & {
    expediente: string;
    modo: string;
    created_by_email?: string | null;
    created_at: string;
  };

export interface EmbarqueDetalleTabsProps {
  embarque: EmbarqueProp;
  embarqueId: string;
  activeTab: string;
  setActiveTab: (t: string) => void;
  estadoVisual: string;
  canEdit: boolean;
  documentos: DocsProps["documentos"];
  conceptosVenta: CostosProps["conceptosVenta"];
  conceptosCosto: CostosProps["conceptosCosto"];
  facturas: FacturacionProps["facturas"];
  notas: NotasProps["notas"];
  financials: Financials;
  docHandlers: DocHandlers;
}

export type PnlView = "global" | "contenedor";
