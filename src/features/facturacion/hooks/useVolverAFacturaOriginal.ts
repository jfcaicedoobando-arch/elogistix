/**
 * useVolverAFacturaOriginal — Si la factura actual es un borrador sustituto de otra
 * (flujo Sustituir CFDI), calcula href/label para regresar a la factura original en
 * lugar del listado.
 */
import { useMemo } from "react";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import { findOriginalFacturaIdFor } from "@/features/facturacion/components/sustitucion/persistence";

export function useVolverAFacturaOriginal(id: string | undefined): {
  href: string;
  label: string;
} {
  const originalFacturaId = useMemo(() => (id ? findOriginalFacturaIdFor(id) : null), [id]);
  const originalFactura = useFactura(originalFacturaId ?? undefined);
  const href = originalFacturaId ? `/facturacion/${originalFacturaId}` : "/facturacion";
  const label = originalFacturaId
    ? `Volver a factura ${originalFactura.data?.numero ?? "original"}`
    : "Volver";
  return { href, label };
}
