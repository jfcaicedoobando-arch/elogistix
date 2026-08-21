/**
 * Subcomponentes compartidos del formulario de factura de proveedor.
 * Tipos movidos a `@/features/cxp/types` (Bloque 1.3); se re-exportan aquí
 * para no romper consumidores que aún importan desde este archivo.
 */
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Hint } from "@/components/shared/Hint";

export type {
  FacturaFormValues,
  
} from "@/features/cxp/types";


interface FormSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <SectionHeading
        as="h3"
        variant="overline"
        icon={icon ? <span className="text-primary/70">{icon}</span> : null}
      >
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  // v13.712.0 — Una sola línea: el texto largo vive en el tooltip para no
  // empujar el resto del formulario (los usuarios lo reportaban como "feo").
  return (
    <Hint label={msg}>
      <p className="mt-1 flex items-center gap-1 text-body-sm text-destructive">
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{msg}</span>
      </p>
    </Hint>
  );
}


export function RequiredMark() {
  return <span className="text-destructive ml-0.5" aria-hidden>*</span>;
}
