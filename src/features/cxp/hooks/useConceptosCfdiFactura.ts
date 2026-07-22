/**
 * Lee los conceptos fiscales del CFDI persistidos en
 * `proveedor_facturas_conceptos` para una factura de proveedor.
 *
 * Estas filas representan las líneas del XML del proveedor (informativas
 * para auditoría fiscal) y se muestran en el detalle de la factura.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConceptoCfdiRow {
  id: string;
  descripcion: string;
  cantidad: number;
  clave_unidad: string | null;
  monto: number;
  iva: number;
  ieps: number;
  created_at: string;
}

async function fetchConceptosCfdi(facturaId: string): Promise<ConceptoCfdiRow[]> {
  const { data, error } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("id, descripcion, cantidad, clave_unidad, monto, iva, ieps, created_at")
    .eq("proveedor_factura_id", facturaId)
    .is("concepto_costo_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConceptoCfdiRow[];
}

export function useConceptosCfdiFactura(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ["cxp", "conceptos-cfdi", facturaId ?? null] as const,
    queryFn: () => fetchConceptosCfdi(facturaId as string),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}
