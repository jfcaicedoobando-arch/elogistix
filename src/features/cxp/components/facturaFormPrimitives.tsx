/**
 * Tipos y subcomponentes compartidos del formulario de factura de proveedor.
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
  retenciones: string;
  categoriaId: string;
  notas: string;
}

export interface CategoriaPresupuestoLite { id: string; nombre: string }

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}
