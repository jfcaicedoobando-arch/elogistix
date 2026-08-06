/**
 * Button — control de acción unificado del sistema.
 *
 * v13.431.0 (Armonización visual global · Lote D). Todas las variantes
 * comparten peso de fuente, radio, sombra y transición
 * (`transition-colors duration-150`); los estados hover/active/focus-visible/
 * disabled quedan definidos aquí una sola vez, con el mismo anillo de foco
 * que los campos de formulario (`ring-ring/40`, ver field.tokens.ts).
 *
 * Estado `loading`: siguiendo la convención ya usada en el repo
 * (Loader2 + `animate-spin` reemplazando el ícono mientras se espera una
 * mutación), Button acepta `loading` para mostrar el spinner y deshabilitar
 * el control automáticamente, sin que cada consumidor repita el patrón.
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent/40",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Ola 7 · Lote A — reemplaza usos inline `bg-accent text-accent-foreground hover:bg-accent/90`.
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 hover:shadow",
      },
      size: {
        // En mobile (<md) los tap targets cumplen 44px (Apple HIG / Material AA);
        // en ≥md regresan a tamaños compactos para densidad de escritorio.
        default: "h-11 md:h-10 px-4 py-2",
        sm: "h-10 md:h-9 rounded-md px-3",
        lg: "h-12 md:h-11 rounded-md px-6",
        icon: "h-11 w-11 md:h-10 md:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Muestra un spinner y deshabilita el botón (mutaciones en curso). */
  loading?: boolean;
}

const Button = ({
  ref,
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  // `asChild` delega el markup al hijo (p. ej. <Link>): Slot exige UN solo
  // elemento hijo, por lo que no inyectamos el spinner en ese caso.
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
};
Button.displayName = "Button";

export { Button, buttonVariants };
