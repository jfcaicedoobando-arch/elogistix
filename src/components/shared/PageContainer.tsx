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
  /**
   * `default` (max-w-screen-2xl, 1536px) para páginas normales.
   * `wide` (max-w-[1720px]) para listados densos: Facturación, Cobranza, CxP,
   *  donde columnas fijas + acciones dejan las tablas apretadas en 1440-1600.
   *  Introducido en Sprint 2 (v13.302.1) de la auditoría UI/UX.
   */
  width?: "default" | "wide";
}

export function PageContainer({
  children,
  className,
  noSpacing = false,
  width = "default",
  ...rest
}: PageContainerProps) {
  return (
    <div
      {...rest}
      className={cn(
        // Ola 9: en pantallas de ≤800px de alto (1280x720, laptops 768p) se
        // compactan padding y ritmo vertical para ganar filas visibles.
        "mx-auto w-full p-4 sm:p-6 short:sm:p-4",
        width === "wide" ? "max-w-[1720px]" : "max-w-screen-2xl",
        !noSpacing && "space-y-6 short:space-y-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

