/**
 * Resuelve el último caso de refacturación ligado a una factura (como original
 * o como sustituta) y, si existe, muestra su sección de trazabilidad.
 */
import { useUltimoCasoRefacturacion } from "@/features/facturacion/hooks/useRefacturacionExpediente";
import { RefacturacionTrazabilidadCard } from "./RefacturacionTrazabilidadCard";

export function RefacturacionTrazabilidadSection({ facturaId }: { facturaId: string }) {
  const { data: casoId } = useUltimoCasoRefacturacion(facturaId);
  if (!casoId) return null;
  return <RefacturacionTrazabilidadCard casoId={casoId} />;
}
