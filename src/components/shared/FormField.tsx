import { Children, cloneElement, isValidElement, ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Wrapper estándar para campos de formulario en wizards.
 * Proporciona spacing label↔input y manejo consistente de errores.
 *
 * UX-04: el label se liga al control con `htmlFor`/`id` (id generado con
 * `useId`) y el mensaje de error con `aria-describedby`, para que lectores de
 * pantalla anuncien el campo y su error al enfocarlo.
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
  /** Id explícito del control; si se omite se genera uno automáticamente. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

export function FormField({
  label,
  required,
  hint,
  error,
  span,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  const autoId = useId();
  const controlId = htmlFor ?? `field-${autoId}`;
  const errorId = `${controlId}-error`;

  const spanClass =
    span === 2 ? "md:col-span-2"
    : span === "full" ? "col-span-full"
    : "";

  // Sólo se inyecta el id en el primer hijo elemento y sólo si no trae uno.
  const control = Children.map(children, (child, index) => {
    if (index > 0 || !isValidElement<ControlProps>(child)) return child;
    return cloneElement(child, {
      id: child.props.id ?? controlId,
      "aria-invalid": error ? true : child.props["aria-invalid"],
      "aria-describedby": error ? errorId : child.props["aria-describedby"],
    });
  });

  return (
    <div className={cn("space-y-2", spanClass, className)}>
      {label && (
        <Label htmlFor={controlId} className="font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
          {hint && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {hint}
            </span>
          )}
        </Label>
      )}
      {control}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
