import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils/cn";

/**
 * Regresión V-01 (auditoría visual 2026-08-21): las utilidades de la escala
 * tipográfica propia no deben borrar el color de texto de la variante.
 */
describe("cn — escala tipográfica vs color de texto", () => {
  const sizes = [
    "text-display",
    "text-kpi",
    "text-2xs",
    "text-3xs",
    "text-label",
    "text-section",
    "text-subsection",
    "text-card-title",
    "text-table-head",
    "text-body",
    "text-body-sm",
  ];

  it.each(sizes)("conserva el color junto a %s", (size) => {
    const result = cn("text-primary-foreground", size);
    expect(result).toContain("text-primary-foreground");
    expect(result).toContain(size);
  });

  it("sigue colapsando dos tamaños de fuente en el último", () => {
    expect(cn("text-body", "text-body-sm")).toBe("text-body-sm");
  });

  it("sigue colapsando dos colores de texto en el último", () => {
    expect(cn("text-muted-foreground", "text-destructive")).toBe("text-destructive");
  });
});
