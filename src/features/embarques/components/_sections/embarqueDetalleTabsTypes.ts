/**
 * Tipos derivados para `EmbarqueDetalleTabs`.
 *
 * v13.309.24 · Ítem 3.5 auditoría 3: la data-fetching se mudó a
 * `useEmbarqueDetalleTabsData`. El componente sólo recibe la superficie
 * pública mínima (embarque, id, tab, permisos). Los tipos `Financials`,
 * `DocHandlers`, etc. quedan por si otros consumidores los necesitan.
 */
import type { ComponentProps } from "react";
import type { TabResumen } from "@/features/embarques/components/TabResumen";
import type { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
import type { TabCostos } from "@/features/embarques/components/TabCostos";
import type { TabFacturacion } from "@/features/embarques/components/TabFacturacion";
import type { TabNotas } from "@/features/embarques/components/TabNotas";
import type { TabTracking } from "@/features/embarques/components/TabTracking";
import type { EmbarqueRow } from "@/features/embarques/types/embarque";

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

// v13.309.50 · PR-S2-B: unificamos con `EmbarqueRow` (Tables<"embarques">) —
// que ya satisface TabResumen/TabFacturacion/TabTracking y expone todos los
// campos que la vista consume. Elimina el `as unknown as` histórico.
export type EmbarqueProp = EmbarqueRow;

export interface EmbarqueDetalleTabsProps {
  embarque: EmbarqueProp;
  embarqueId: string;
  activeTab: string;
  setActiveTab: (t: string) => void;
  estadoVisual: string;
  canEdit: boolean;
}

export type PnlView = "global" | "contenedor";
