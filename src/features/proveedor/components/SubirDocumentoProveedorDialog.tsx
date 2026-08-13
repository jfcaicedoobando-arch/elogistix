/**
 * Ola 3 / Ola 4 — Modal para agregar un documento al expediente del proveedor.
 * Envoltorio del modal compartido: misma UI y mismas validaciones que cliente.
 */
import { SubirDocumentoDialog } from "@/features/expediente/components/SubirDocumentoDialog";
import {
  TIPOS_DOCUMENTO_PROVEEDOR,
  TIPOS_CON_VENCIMIENTO,
  type TipoDocumentoProveedor,
} from "@/features/proveedor/domain/documentosProveedor";
import { useSubirDocumentoProveedor } from "@/features/proveedor/hooks/useProveedorDocumentos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorId: string;
  organizationId: string;
  tipoSugerido?: TipoDocumentoProveedor;
}

export function SubirDocumentoProveedorDialog({
  open, onOpenChange, proveedorId, organizationId, tipoSugerido,
}: Props) {
  const subir = useSubirDocumentoProveedor(proveedorId);

  return (
    <SubirDocumentoDialog
      open={open}
      onOpenChange={onOpenChange}
      tipos={TIPOS_DOCUMENTO_PROVEEDOR}
      tiposConVencimiento={TIPOS_CON_VENCIMIENTO}
      tipoSugerido={tipoSugerido}
      descripcion="Guarda constancias, opiniones de cumplimiento, contratos y comprobantes bancarios del proveedor."
      isPending={subir.isPending}
      onGuardar={(v) =>
        subir.mutate(
          {
            proveedorId,
            organizationId,
            tipo: v.tipo as TipoDocumentoProveedor,
            archivo: v.archivo,
            fechaDocumento: v.fechaDocumento,
            fechaVencimiento: v.fechaVencimiento,
            notas: v.notas,
          },
          { onSuccess: () => onOpenChange(false) },
        )
      }
    />
  );
}
