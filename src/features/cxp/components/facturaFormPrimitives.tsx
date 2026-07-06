/**
 * Tipos y subcomponentes compartidos del formulario de factura de proveedor.
 */
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
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

export interface CategoriaPresupuestoLite { id: string; nombre: string }

interface FormSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon ? <span className="text-primary/70">{icon}</span> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" aria-hidden />
      {msg}
    </p>
  );
}

export function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden>*</span>;
}
