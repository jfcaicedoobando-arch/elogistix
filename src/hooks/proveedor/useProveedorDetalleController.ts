import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProveedor, useProveedorMutations, useProveedorOperaciones } from "@/hooks/proveedor/useProveedores";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";

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
  const { toast } = useToast();

  const { data: operaciones = [] } = useProveedorOperaciones(id);

  const totalFacturado = operaciones.reduce((sum, o) => sum + o.monto, 0);
  const totalPagado = operaciones
    .filter(o => o.estadoLiquidacion === 'Pagado')
    .reduce((sum, o) => sum + o.monto, 0);
  const totalPendiente = totalFacturado - totalPagado;

  const handleUpdate = useCallback(async (provId: string, data: Record<string, unknown>) => {
    try {
      await updateProveedor(provId, data);
      toast({ title: "Proveedor actualizado" });
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  }, [updateProveedor, toast]);

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
      toast({ title: "Proveedor eliminado" });
      navigate("/proveedores");
    } catch {
      toast({ title: "Error al eliminar proveedor", variant: "destructive" });
    }
  }, [proveedor, deleteProveedor, registrarActividad, toast, navigate]);

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
