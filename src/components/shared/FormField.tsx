import { Children, cloneElement, isValidElement, ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger } from "@/components/ui/select";

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

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; children?: ReactNode };

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
  const primero = Children.toArray(children)[0];
  const selectTrigger = isValidElement<ControlProps>(primero) && primero.type === Select
    ? Children.toArray(primero.props.children).find((c) => isValidElement(c) && c.type === SelectTrigger)
    : undefined;
  const idHijo =
    isValidElement<ControlProps>(selectTrigger) ? selectTrigger.props.id
    : isValidElement<ControlProps>(primero) ? primero.props.id : undefined;
  const controlId = htmlFor ?? idHijo ?? `field-${autoId}`;
  const errorId = `${controlId}-error`;

  const spanClass =
    span === 2 ? "md:col-span-2"
    : span === "full" ? "col-span-full"
    : "";

  const asociarControl = (child: React.ReactElement<ControlProps>) => cloneElement(child, {
    id: controlId,
    "aria-invalid": error ? true : child.props["aria-invalid"],
    "aria-describedby": [child.props["aria-describedby"], error ? errorId : undefined].filter(Boolean).join(" ") || undefined,
  });

  // Radix Select.Root no es un nodo DOM: ligar el label al trigger real.
  const control = Children.map(children, (child, index) => {
    if (index > 0 || !isValidElement<ControlProps>(child)) return child;
    if (child.type === Select) {
      return cloneElement(child, {
        children: Children.map(child.props.children, (selectChild) =>
          isValidElement<ControlProps>(selectChild) && selectChild.type === SelectTrigger
            ? asociarControl(selectChild) : selectChild),
      });
    }
    return asociarControl(child);
  });

  return (
    <div className={cn("space-y-2", spanClass, className)}>
      {label && (
        <Label htmlFor={controlId} className="font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
          {hint && (
            <span className="text-body-sm text-muted-foreground font-normal ml-2">
              {hint}
            </span>
          )}
        </Label>
      )}
      {control}
      {error && (
        <p id={errorId} className="text-body-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
