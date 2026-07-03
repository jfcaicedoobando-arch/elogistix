/**
 * `<PageContainer />` — contenedor estándar para el contenido principal
 * de cada página.
 *
 * Extrae el patrón `mx-auto w-full max-w-screen-2xl p-4 sm:p-6` que hoy
 * vive en `Layout.tsx` y añade `space-y-6` por defecto para dar ritmo
 * vertical uniforme entre módulos. Las páginas legacy que aplican su propio
 * padding (CRM) se limpiarán en la Oleada 4.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Desactiva el `space-y-6` cuando la página necesita layout custom. */
  noSpacing?: boolean;
}

export function PageContainer({
  children,
  className,
  noSpacing = false,
  ...rest
}: PageContainerProps) {
  return (
    <div
      {...rest}
      className={cn(
        "mx-auto w-full max-w-screen-2xl p-4 sm:p-6",
        !noSpacing && "space-y-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
