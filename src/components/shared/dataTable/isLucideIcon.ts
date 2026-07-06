import type { LucideIcon } from "lucide-react";

/**
 * Discrimina entre un LucideIcon y un ReactNode ya renderizado.
 * Los íconos de `lucide-react` v0.462+ son `React.forwardRef`, cuya forma
 * runtime es un objeto `{ $$typeof, render, displayName }` (NO una función).
 * Si sólo chequeamos `typeof === "function"`, el icono cae al branch que lo
 * renderiza como children y React lanza el invariant #31.
 */
export function isLucideIcon(x: unknown): x is LucideIcon {
  if (typeof x === "function") return true;
  if (typeof x !== "object" || x === null) return false;
  const obj = x as { $$typeof?: unknown; render?: unknown };
  return typeof obj.render === "function" && obj.$$typeof !== undefined;
}
