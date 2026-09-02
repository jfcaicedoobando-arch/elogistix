import { useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProveedor, useProveedorMutations } from "@/features/proveedor/hooks/useProveedores";
import { useProveedorEstadoCuenta } from "@/features/proveedor/hooks/useProveedorEstadoCuenta";
import { calcularAgregadosProveedor } from "@/features/proveedor/domain/agregadosProveedor";
import { calcularBrechaFacturacion } from "@/features/proveedor/domain/estadoCuentaProveedor";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useRegistrarActividad } from "@/features/auditoria/hooks/useBitacora";
import { diffFields, SENSITIVE_FIELDS } from "@/features/auditoria/utils/diffFields";


/**
 * Controller para la página de detalle de proveedor.
 * Encapsula carga, mutaciones, totales, dialogs y handlers.
 *
 * v13.555.0 — la fuente del historial ya no es sólo `conceptos_costo`: la RPC
 * `proveedor_estado_cuenta` entrega cada partida costeada conciliada contra las
 * facturas reales del proveedor y sus pagos.
 */
export function useProveedorDetalleController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    data: proveedor, isLoading,
    isError: isErrorProveedor, error: errorProveedor, refetch: refetchProveedor,
  } = useProveedor(id);
  const { updateProveedor, deleteProveedor, isDeleting } = useProveedorMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { canEdit, isAdmin } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  const {
    data: estadoCuenta,
    isLoading: isLoadingEstadoCuenta,
    isError: isErrorEstadoCuenta,
    error: errorEstadoCuenta,
    refetch: refetchEstadoCuenta,
    isFetching: isFetchingEstadoCuenta,
  } = useProveedorEstadoCuenta(id);
  const partidas = useMemo(() => estadoCuenta?.partidas ?? [], [estadoCuenta]);
  const huerfanas = useMemo(() => estadoCuenta?.facturas_huerfanas ?? [], [estadoCuenta]);
  const { data: rates } = useExchangeRates();

  // FIX 9.1 — Los conceptos vienen en moneda nativa: se agregan por moneda y se
  // convierten a un único equivalente MXN (nunca se suman USD como si fueran MXN).
  const operaciones = useMemo(
    () => partidas.map((p) => ({
      monto: p.comprometido,
      moneda: p.moneda,
      estadoLiquidacion: p.estado_liquidacion,
      montoPagado: p.pagado,
    })),
    [partidas],
  );
  const agregados = useMemo(
    () => calcularAgregadosProveedor(operaciones, rates?.usdMxn ?? 0),
    [operaciones, rates?.usdMxn],
  );
  const brecha = useMemo(() => calcularBrechaFacturacion(partidas), [partidas]);
  const { totalFacturado, totalPagado, totalPendiente } = agregados;

  // NOTA (v13.320.63): los toasts de éxito/error de update y delete los emite
  // `useProveedorMutations`. No los repitas aquí o el usuario ve doble aviso.
  const handleUpdate = useCallback(async (
    provId: string,
    data: Record<string, unknown>,
    expectedUpdatedAt?: string | null,
    organizationId?: string | null,
  ) => {
    const cambios = proveedor
      ? diffFields(
          proveedor,
          data,
          SENSITIVE_FIELDS.proveedor,
        )
      : [];
    // N-06: no atrapamos el error aquí — el diálogo (EditarProveedorDialog)
    // necesita que la promesa se rechace para NO cerrarse ante un conflicto
    // de concurrencia u otro fallo de guardado. El toast lo emite
    // `useProveedorMutations.onError`.
    await updateProveedor(provId, data, expectedUpdatedAt, organizationId);
    registrarActividad.mutate({
      accion: "editar",
      modulo: "proveedores",
      entidad_id: provId,
      entidad_nombre: (data.nombre as string) ?? proveedor?.nombre ?? "",
      detalles: cambios.length > 0 ? { cambios } : undefined,
    });
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
    isErrorProveedor,
    errorProveedor,
    refetchProveedor,
    isDeleting,
    operaciones,
    partidas,
    huerfanas,
    brecha,
    isLoadingEstadoCuenta,
    isErrorEstadoCuenta,
    errorEstadoCuenta,
    refetchEstadoCuenta,
    isFetchingEstadoCuenta,
    totalFacturado,
    totalPagado,
    totalPendiente,
    agregados,
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
