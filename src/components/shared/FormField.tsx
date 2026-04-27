import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Wrapper estándar para campos de formulario en wizards.
 * Proporciona spacing label↔input y manejo consistente de errores.
 *
 * Uso:
 *   <FormField label="Cliente" required error={errors.clienteId}>
 *     <Select ... />
 *   </FormField>
 */
interface FormFieldProps {
  label?: string;
  /** Marca el label con asterisco "*" */
  required?: boolean;
  /** Texto auxiliar bajo el label */
  hint?: string;
  /** Mensaje de error (en color destructive bajo el control) */
  error?: string;
  /** Hace que el field ocupe varias columnas en un grid */
  span?: 1 | 2 | "full";
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required,
  hint,
  error,
  span,
  className,
  children,
}: FormFieldProps) {
  const spanClass =
    span === 2 ? "md:col-span-2"
    : span === "full" ? "col-span-full"
    : "";

  return (
    <div className={cn("space-y-2", spanClass, className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
          {hint && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {hint}
            </span>
          )}
        </Label>
      )}
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
