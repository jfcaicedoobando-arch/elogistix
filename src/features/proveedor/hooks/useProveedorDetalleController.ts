import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProveedor, useProveedorMutations, useProveedorOperaciones } from "@/features/proveedor/hooks/useProveedores";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useRegistrarActividad } from "@/features/auditoria/hooks/useBitacora";
import { diffFields, SENSITIVE_FIELDS } from "@/features/auditoria/utils/diffFields";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
/**
 * Controller para la página de detalle de proveedor.
 * Encapsula carga, mutaciones, totales, dialogs y handlers.
 */
export function useProveedorDetalleController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proveedor, isLoading } = useProveedor(id);
  const { updateProveedor, deleteProveedor, isDeleting } = useProveedorMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { canEdit, isAdmin } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  const { data: operaciones = [] } = useProveedorOperaciones(id);

  const totalFacturado = operaciones.reduce((sum, o) => sum + o.monto, 0);
  const totalPagado = operaciones
    .filter(o => o.estadoLiquidacion === 'Pagado')
    .reduce((sum, o) => sum + o.monto, 0);
  const totalPendiente = totalFacturado - totalPagado;

  const handleUpdate = useCallback(async (provId: string, data: Record<string, unknown>) => {
    try {
      const cambios = proveedor
        ? diffFields(
            proveedor,
            data,
            SENSITIVE_FIELDS.proveedor,
          )
        : [];
      await updateProveedor(provId, data);
      registrarActividad.mutate({
        accion: "editar",
        modulo: "proveedores",
        entidad_id: provId,
        entidad_nombre: (data.nombre as string) ?? proveedor?.nombre ?? "",
        detalles: cambios.length > 0 ? { cambios } : undefined,
      });
      notifySuccess(undefined, { title: "Proveedor actualizado" });
    } catch {
      notifyError(undefined, { title: "Error al actualizar", method: "USE_PROVEEDOR_DETALLE_CONTROLLER", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  }, [updateProveedor, proveedor, registrarActividad]);

  const handleDelete = useCallback(async () => {
    if (!proveedor) return;
    try {
      await deleteProveedor(proveedor.id);
      registrarActividad.mutate({
        accion: 'eliminar',
        modulo: 'proveedores',
        entidad_id: proveedor.id,
        entidad_nombre: proveedor.nombre,
      });
      notifySuccess(undefined, { title: "Proveedor eliminado" });
      navigate("/compras/proveedores");
    } catch {
      notifyError(undefined, { title: "Error al eliminar proveedor", method: "USE_PROVEEDOR_DETALLE_CONTROLLER", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  }, [proveedor, deleteProveedor, registrarActividad, navigate]);

  return {
    proveedor,
    isLoading,
    isDeleting,
    operaciones,
    totalFacturado,
    totalPagado,
    totalPendiente,
    canEdit,
    isAdmin,
    editOpen,
    setEditOpen,
    deleteOpen,
    setDeleteOpen,
    handleUpdate,
    handleDelete,
    navigate,
  };
}
