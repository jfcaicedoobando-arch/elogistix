/**
 * useReferenciasEmbarqueFactura — v13.209.1
 *
 * Devuelve el trío Expediente + BL Master + BL House que se propagará al
 * CFDI cuando se timbre la factura. Prioridad:
 *   1. Si `factura.embarque_id` está presente → lee del embarque (vía servicio).
 *   2. Fallback a los snapshots en la propia factura.
 *
 * La consulta al cliente Supabase vive en el servicio
 * `services/referenciasEmbarque.ts` para respetar la jerarquía de capas.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchReferenciasEmbarque } from "@/features/facturacion/services/referenciasEmbarque";

export interface ReferenciasEmbarqueFactura {
  expediente: string | null;
  bl_master: string | null;
  bl_house: string | null;
}

interface FacturaInput {
  embarque_id?: string | null;
  expediente?: string | null;
  referencia_bl?: string | null;
}

export function computeReferenciasFallback(factura: FacturaInput | null | undefined): ReferenciasEmbarqueFactura {
  return {
    expediente: factura?.expediente ?? null,
    bl_master: null,
    bl_house: factura?.referencia_bl ?? null,
  };
}

export function hasAlgunaReferencia(ref: ReferenciasEmbarqueFactura | null | undefined): boolean {
  if (!ref) return false;
  return Boolean(
    (ref.expediente && ref.expediente.trim()) ||
    (ref.bl_master && ref.bl_master.trim()) ||
    (ref.bl_house && ref.bl_house.trim()),
  );
}

export function formatearPrefijoReferencias(ref: ReferenciasEmbarqueFactura | null | undefined): string {
  if (!hasAlgunaReferencia(ref)) return "";
  const parts: string[] = [];
  if (ref?.expediente?.trim()) parts.push(`Exp. ${ref.expediente.trim()}`);
  if (ref?.bl_master?.trim()) parts.push(`BL/M: ${ref.bl_master.trim()}`);
  if (ref?.bl_house?.trim()) parts.push(`BL/H: ${ref.bl_house.trim()}`);
  return `[${parts.join(" · ")}] `;
}

export function useReferenciasEmbarqueFactura(factura: FacturaInput | null | undefined) {
  const embarqueId = factura?.embarque_id ?? null;
  return useQuery<ReferenciasEmbarqueFactura>({
    queryKey: ["referencias_embarque_factura", embarqueId, factura?.expediente ?? "", factura?.referencia_bl ?? ""],
    enabled: !!factura,
    staleTime: 60_000,
    queryFn: async () => {
      const fallback = computeReferenciasFallback(factura);
      if (!embarqueId) return fallback;
      const row = await fetchReferenciasEmbarque(embarqueId);
      if (!row) return fallback;
      return {
        expediente: row.expediente ?? fallback.expediente,
        bl_master: row.bl_master ?? null,
        bl_house: row.bl_house ?? fallback.bl_house,
      };
    },
  });
}
