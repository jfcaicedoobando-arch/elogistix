import * as React from "react";

import { cn } from "@/lib/utils";

const setNativeInputValue = (el: HTMLInputElement, value: string) => {
  const proto = Object.getPrototypeOf(el) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const Input = ({ ref, className, type, onWheel, onFocus, onBlur, ...props }: React.ComponentProps<"input"> & { ref?: React.Ref<HTMLInputElement> }) => {
    const handleWheel = React.useCallback(
      (e: React.WheelEvent<HTMLInputElement>) => {
        // Evita que la rueda del mouse cambie el valor en inputs numéricos
        // (comportamiento nativo del navegador). Desenfocamos y re-enfocamos
        // para mantener el cursor sin modificar el valor.
        if (type === "number" && e.currentTarget === document.activeElement) {
          const target = e.currentTarget;
          target.blur();
          setTimeout(() => target?.focus({ preventScroll: true }), 0);
        }
        onWheel?.(e);
      },
      [type, onWheel],
    );

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Limpia el "0" inicial al enfocar inputs numéricos para que el
        // usuario pueda escribir directamente sin quedar con "05".
        if (type === "number") {
          const raw = e.currentTarget.value;
          if (raw === "0" || Number(raw) === 0) {
            setNativeInputValue(e.currentTarget, "");
          }
        }
        onFocus?.(e);
      },
      [type, onFocus],
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Si el usuario deja el campo numérico vacío, restauramos "0"
        // para no romper cálculos/validaciones que asumen número.
        if (type === "number" && e.currentTarget.value === "") {
          setNativeInputValue(e.currentTarget, "0");
        }
        onBlur?.(e);
      },
      [type, onBlur],
    );

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onWheel={handleWheel}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  };

Input.displayName = "Input";

export { Input };
