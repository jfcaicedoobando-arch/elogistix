/**
 * Estado "sin permiso" del modal de captura de factura de proveedor.
 * Extraído de `DialogNuevaFacturaProveedor` para respetar el límite de
 * complejidad (Power-of-10) y poder testearlo por separado.
 */
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogFacturaProveedorSinPermiso({ open, onOpenChange }: Props) {
  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileSpreadsheet}
      title="Capturar factura de proveedor"
      description="Tu rol no puede capturar facturas de proveedor."
      size="md"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        No tienes permiso para esta sección. Pide a un administrador, contador o auxiliar
        contable que capture la factura.
      </p>
    </FormDialogShell>
  );
}
