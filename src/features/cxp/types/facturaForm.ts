/**
 * Tipos de dominio del formulario de factura de proveedor.
 * Extraídos de componentes `.tsx` (Bloque 1.3 auditoría 2026-07-23) para
 * romper ciclos entre hooks y components.
 */
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

export interface FacturaFormValues {
  provId: string;
  provNombre: string;
  folio: string;
  emision: string;
  diasCredito: number;
  vencimiento: string;
  moneda: Moneda;
  tc: string;
  subtotal: string;
  iva: string;
  ieps: string;
  retenciones: string;
  categoriaId: string;
  notas: string;
}

export interface CategoriaPresupuestoLite {
  id: string;
  nombre: string;
  /** v13.510.0 — Permite fijar COGS cuando el documento nació de un embarque. */
  tipo_contable?: Database["public"]["Enums"]["tipo_contable_categoria"] | null;
}

export type TcOrigen = "dof" | "cfdi" | "manual" | "vacio";
