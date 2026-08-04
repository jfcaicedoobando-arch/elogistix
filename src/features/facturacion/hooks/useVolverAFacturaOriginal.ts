/**
 * useVolverAFacturaOriginal — Si la factura actual es un borrador sustituto de otra
 * (flujo Sustituir CFDI), calcula href/label para regresar a la factura original en
 * lugar del listado.
 *
 * Fuente de verdad: `facturas.sustituye_a` (BD, persiste entre refreshes y dispositivos).
 * Fallback: `findOriginalFacturaIdFor(id)` sobre `sessionStorage` para el instante
 * previo a que el detalle termine de cargar.
 */
import { useMemo } from "react";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import { findOriginalFacturaIdFor } from "@/features/facturacion/services/sustitucionPersistence";
import { useVolver } from "@/hooks/shared/useVolver";

export function useVolverAFacturaOriginal(
  id: string | undefined,
  sustituyeA?: string | null,
): {
  href: string | (() => void);
  label: string;
} {
  const originalFacturaId = useMemo(() => {
    if (sustituyeA) return sustituyeA;
    if (!id) return null;
    return findOriginalFacturaIdFor(id);
  }, [id, sustituyeA]);
  const originalFactura = useFactura(originalFacturaId ?? undefined);
  const volverAlListado = useVolver("/facturacion");
  const href = originalFacturaId ? `/facturacion/${originalFacturaId}` : volverAlListado;
  const label = originalFacturaId
    ? `Volver a factura ${originalFactura.data?.numero ?? "original"}`
    : "Volver";
  return { href, label };
}
