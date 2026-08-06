import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD_HEIGHT_CLASS, FIELD_STATE_CLASS, FIELD_SURFACE_CLASS } from "./field.tokens";

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
          "flex text-base md:text-sm",
          FIELD_HEIGHT_CLASS,
          FIELD_SURFACE_CLASS,
          FIELD_STATE_CLASS,
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
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
