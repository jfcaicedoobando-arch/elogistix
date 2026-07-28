import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProveedor, useProveedorMutations, useProveedorOperaciones } from "@/features/proveedor/hooks/useProveedores";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useRegistrarActividad } from "@/features/auditoria/hooks/useBitacora";
import { diffFields, SENSITIVE_FIELDS } from "@/features/auditoria/utils/diffFields";


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

  // NOTA (v13.320.63): los toasts de éxito/error de update y delete los emite
  // `useProveedorMutations`. No los repitas aquí o el usuario ve doble aviso.
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
    } catch {
      // Silencioso a propósito: `useProveedorMutations.onError` ya notificó.
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
      navigate("/compras/proveedores");
    } catch {
      // Silencioso a propósito: `useProveedorMutations.onError` ya notificó.
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
