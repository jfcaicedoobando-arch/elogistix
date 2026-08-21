import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * V-01 (auditoría visual 2026-08-21) — `tailwind-merge` no conoce la escala
 * tipográfica propia del proyecto (`text-display`, `text-body`, `text-label`…),
 * así que la clasificaba como *color de texto* y borraba en silencio clases
 * legítimas como `text-primary-foreground`. Resultado: texto invisible
 * (contraste 1.24:1) en chips y badges con variante de color.
 *
 * Declarando el grupo `font-size` con los escalones del contrato tipográfico
 * (ver `tailwind.config.ts` → `theme.extend.fontSize`), tamaño y color dejan
 * de competir entre sí.
 */
const FONT_SIZES = [
  "display",
  "kpi",
  "2xs",
  "3xs",
  "label",
  "section",
  "subsection",
  "card-title",
  "table-head",
  "body",
  "body-sm",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
