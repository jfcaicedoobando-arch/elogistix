/**
 * Helpers puros para /compras/por-aprobar. Extraído de `ComprasPorAprobar.kpi.tsx`
 * para cumplir react-refresh/only-export-components (un archivo = solo componentes).
 */
import type { FacturaCxP } from "@/features/cxp/services";

export function sumaMxn(rows: FacturaCxP[]): number {
  return rows
    .filter((f) => f.moneda === "MXN")
    .reduce((acc, f) => acc + Number(f.total ?? 0), 0);
}

export function sumaUsd(rows: FacturaCxP[]): number {
  return rows
    .filter((f) => f.moneda === "USD")
    .reduce((acc, f) => acc + Number(f.total ?? 0), 0);
}
