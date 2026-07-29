/**
 * Deep-links de /compras/facturas.
 *
 * `?factura={id}` → abre el modal de detalle si la factura ya cargó y limpia
 * el query param (nuqs, `setFacturaParam(null)`).
 *
 * M10 (auditoría 2026-07-29): el efecto mount-only de `?aprobacion=` se
 * eliminó — al ser `aprobacion` un filtro nuqs más (`useCxpPageState`), la URL
 * lo inicializa sola y además reacciona a navegaciones con la página montada.
 */
import { useEffect } from "react";
import { useQueryState } from "nuqs";
import type { FacturaCxP } from "@/features/cxp/services";

export interface UseCxpDeepLinksArgs {
  data: FacturaCxP[];
  isLoading: boolean;
  onOpenDetalle: (fact: FacturaCxP) => void;
}

export function useCxpDeepLinks({
  data,
  isLoading,
  onOpenDetalle,
}: UseCxpDeepLinksArgs): void {
  const [facturaParam, setFacturaParam] = useQueryState("factura");

  useEffect(() => {
    if (!facturaParam || isLoading) return;
    const found = data.find((row) => row.id === facturaParam);
    if (!found) return;
    onOpenDetalle(found);
    void setFacturaParam(null);
  }, [facturaParam, data, isLoading, onOpenDetalle, setFacturaParam]);
}
