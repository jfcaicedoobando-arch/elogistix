/**
 * Tipos derivados para `EmbarqueDetalleTabs`.
 *
 * v13.309.24 · Ítem 3.5 auditoría 3: la data-fetching se mudó a
 * `useEmbarqueDetalleTabsData`. El componente sólo recibe la superficie
 * pública mínima (embarque, id, tab, permisos).
 *
 * v13.320.61 · knip strict: se eliminan los tipos derivados que ya nadie
 * consumía (`ResumenProps`, `CostosProps`, `FacturacionProps`, `NotasProps`,
 * `TrackingProps`, `DocHandlers`, `Financials`).
 */
import type { EmbarqueRow } from "@/features/embarques/types/embarque";


// v13.309.50 · PR-S2-B: unificamos con `EmbarqueRow` (Tables<"embarques">) —
// que ya satisface TabResumen/TabFacturacion/TabTracking y expone todos los
// campos que la vista consume. Elimina el el cast doble histórico.
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
