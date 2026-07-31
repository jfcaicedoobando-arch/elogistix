/**
 * Resolución de iconos Lucide para las líneas de tiempo de embarque.
 * Mantiene un único lenguaje visual entre el stepper de fases (Resumen y
 * Tracking) y la bitácora de eventos (interna y portal público).
 */
import {
  Anchor,
  CheckCircle2,
  Container,
  FileCheck2,
  FileText,
  Flag,
  Landmark,
  PackageCheck,
  Plane,
  Ship,
  Truck,
  CalendarClock,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertTriangle,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { FaseIconoId } from "@/features/embarques/domain/embarqueFases";

const ICONO_FASE: Record<FaseIconoId, LucideIcon> = {
  propuesta: FileText,
  confirmado: CheckCircle2,
  transito_maritimo: Ship,
  transito_aereo: Plane,
  transito_terrestre: Truck,
  arribo: Anchor,
  aduana: Landmark,
  entregado: PackageCheck,
  eir: FileCheck2,
  por_liquidar: Wallet,
  cerrado: Flag,
};

/** Icono Lucide de una fase del embarque. */
export function iconoDeFase(id: FaseIconoId): LucideIcon {
  return ICONO_FASE[id] ?? FileText;
}

/** Icono Lucide por tipo de evento de tracking (`tipo_evento_tracking`). */
const ICONO_TIPO_EVENTO: Record<string, LucideIcon> = {
  Zarpe: Ship,
  Transbordo: RefreshCw,
  "Arribo a Puerto": Anchor,
  Descarga: Container,
  "Despacho Aduanal": Landmark,
  Liberación: ShieldCheck,
  "En Ruta Terrestre": Truck,
  Entrega: PackageCheck,
  Demora: AlertTriangle,
  Inspección: Search,
  "Cambio de ETA": CalendarClock,
  Otro: StickyNote,
};

export function iconoDeEvento(tipo: string): LucideIcon {
  return ICONO_TIPO_EVENTO[tipo] ?? StickyNote;
}
