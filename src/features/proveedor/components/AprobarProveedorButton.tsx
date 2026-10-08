/** Botón "Aprobar como proveedor" para Contabilidad (proveedores provisionales). */
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAprobarProveedorProvisional } from "@/features/proveedor/hooks/useProveedoresProvisionales";

export function AprobarProveedorButton({ proveedorId }: { proveedorId: string }) {
  const aprobar = useAprobarProveedorProvisional(proveedorId);
  return (
    <Button size="sm" variant="outline" disabled={aprobar.isPending} onClick={() => aprobar.mutate()}>
      <CheckCircle2 className="mr-2 size-4" /> Aprobar como proveedor
    </Button>
  );
}
