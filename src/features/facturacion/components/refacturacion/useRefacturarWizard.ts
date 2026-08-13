/**
 * Controlador del asistente de refacturación: reúne el caso persistido, el
 * formulario del paso 1, la cancelación de REP/factura y las validaciones por
 * etapa. Se separa del componente para respetar el límite de 200 líneas.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { motivoBloqueoRefacturacion } from "@/features/facturacion/domain/refacturacionPermisos";
import { useRefacturacion } from "@/features/facturacion/hooks/useRefacturacion";
import { useClientesFiscalOpts } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useCancelarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import {
  bloqueoPaso,
  TOTAL_PASOS_REFACTURACION,
  type PagoRefacturacion,
} from "@/features/facturacion/domain/refacturacionPasos";
import {
  bloqueoOrdenante as calcularBloqueoOrdenante,
  pendientesReceptorFiscal,
} from "@/features/facturacion/domain/refacturacionValidaciones";
import { useRefacturacionConsistencia } from "@/features/facturacion/hooks/useRefacturacionConsistencia";
import type { RutaFiscalRefacturacion } from "@/features/facturacion/services/refacturacion";

export function useRefacturarWizard(facturaId: string | null, open: boolean, onClose: () => void) {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { role } = usePermissions();
  // Espejo del guard `_assert_refacturador`: sólo roles contables y de
  // administración operan; los demás quedan en modo consulta.
  const bloqueoPermiso = motivoBloqueoRefacturacion(role as never);
  const puedeOperar = !bloqueoPermiso;
  const s = useRefacturacion(facturaId, open);
  const clientesQuery = useClientesFiscalOpts(organizationId ?? null, open);
  const cancelarFactura = useCancelarFactura();
  const cancelarRep = useCancelarRep(facturaId ?? undefined);

  const [clienteDestinoId, setClienteDestinoId] = useState<string | null>(null);
  const [rutaFiscal, setRutaFiscal] = useState<RutaFiscalRefacturacion>("02");
  const [motivo, setMotivo] = useState("");
  const [pagoSeleccionadoId, setPagoSeleccionadoId] = useState<string | null>(null);
  const [ordenanteNombre, setOrdenanteNombre] = useState("");
  const [ordenanteRfc, setOrdenanteRfc] = useState("");
  const [repEnCurso, setRepEnCurso] = useState<string | null>(null);

  // Al reabrir con un caso vivo, el formulario refleja lo ya decidido.
  useEffect(() => {
    if (!open || !s.caso) return;
    setClienteDestinoId(s.caso.cliente_destino_id);
    setRutaFiscal(s.caso.ruta_fiscal);
    setMotivo(s.caso.motivo);
    setPagoSeleccionadoId((prev) => prev ?? s.caso!.pago_original_id);
  }, [open, s.caso]);

  const pagos: PagoRefacturacion[] = useMemo(
    () => s.pagos.map((p) => ({
      id: p.id,
      fecha_pago: p.fecha_pago,
      monto: Number(p.monto),
      moneda: p.moneda,
      monto_aplicado_factura: p.monto_aplicado_factura === null ? null : Number(p.monto_aplicado_factura),
      uuid_rep: p.uuid_rep ?? null,
      estado_rep: p.estado_rep ?? null,
      rep_cancelado_en: p.rep_cancelado_en ?? null,
    })),
    [s.pagos],
  );

  const receptorDestino = useMemo(() => {
    const c = clientesQuery.data?.find((x) => x.id === clienteDestinoId);
    if (!c) return null;
    return {
      nombre: c.nombre,
      rfc: c.rfc,
      regimen_fiscal: c.regimen_fiscal,
      codigo_postal: c.codigo_postal,
    };
  }, [clientesQuery.data, clienteDestinoId]);

  const receptorPendientes = useMemo(
    () => (receptorDestino ? pendientesReceptorFiscal(receptorDestino) : []),
    [receptorDestino],
  );

  const consistenciaQuery = useRefacturacionConsistencia(
    s.caso?.id ?? null,
    open && Boolean(s.caso?.factura_nueva_id) && s.paso >= 3,
  );
  const consistencia = consistenciaQuery.data ?? null;
  const consistenciaHallazgos = (consistencia?.hallazgos ?? []).map((h) => h.mensaje);

  const bloqueoOrdenanteActual = calcularBloqueoOrdenante(ordenanteNombre, ordenanteRfc);
  const yaReasignado = Boolean(s.caso?.pago_nuevo_id);
  const bloqueo = bloqueoPaso(s.paso, {
    casoAbierto: Boolean(s.caso),
    clienteDestinoId,
    motivo,
    pagos,
    facturaNueva: s.facturaNueva,
    original: s.original,
    pagoSeleccionadoId,
    pagoYaReasignado: yaReasignado,
    receptorPendientes,
    consistenciaHallazgos,
    bloqueoOrdenante: bloqueoOrdenanteActual,
    bloqueoPermiso,
  });

  const clienteDestinoNombre =
    clientesQuery.data?.find((c) => c.id === clienteDestinoId)?.nombre ?? "el cliente destino";

  const handleCancelarRep = (pagoId: string) => {
    if (!puedeOperar) return;
    setRepEnCurso(pagoId);
    cancelarRep.mutate({ pagoId, motivo: "02" }, {
      onSettled: () => { setRepEnCurso(null); s.refrescar(); },
    });
  };

  const handleCancelarOriginal = () => {
    if (!facturaId || !puedeOperar) return;
    const usarSustitucion = rutaFiscal === "01" && Boolean(s.caso?.factura_nueva_id);
    cancelarFactura.mutate(
      usarSustitucion
        ? { facturaId, motivo: "01", sustituidaPorFacturaId: s.caso!.factura_nueva_id! }
        : { facturaId, motivo: "02" },
      { onSettled: () => s.refrescar() },
    );
  };

  const handleIrABorrador = (nuevaId: string) => {
    onClose();
    navigate(`/facturacion/${nuevaId}?accion=timbrar`);
  };

  const handleContinuar = () => {
    if (bloqueo) return;
    if (s.paso === 1) {
      if (!s.caso) {
        if (!facturaId || !clienteDestinoId) return;
        s.abrir.mutate({ facturaId, clienteDestinoId, rutaFiscal, motivo });
        return;
      }
      s.avanzar.mutate(2);
      return;
    }
    if (s.paso === TOTAL_PASOS_REFACTURACION) {
      if (yaReasignado) {
        s.cerrar.mutate(false, { onSuccess: onClose });
        return;
      }
      if (!pagoSeleccionadoId || !s.caso?.factura_nueva_id) return;
      s.reasignar.mutate(
        {
          pagoId: pagoSeleccionadoId,
          facturaDestinoId: s.caso.factura_nueva_id,
          casoId: s.caso.id,
          ordenanteNombre,
          ordenanteRfc,
        },
        { onSuccess: () => s.cerrar.mutate(false, { onSuccess: onClose }) },
      );
      return;
    }
    s.avanzar.mutate(s.paso + 1);
  };

  const accionPendiente =
    s.abrir.isPending || s.avanzar.isPending || s.reasignar.isPending || s.cerrar.isPending;

  return {
    s,
    clientes: clientesQuery.data ?? [],
    clienteDestinoId, setClienteDestinoId,
    clienteDestinoNombre,
    receptorDestino,
    consistencia,
    consistenciaCargando: consistenciaQuery.isFetching,
    rutaFiscal, setRutaFiscal,
    motivo, setMotivo,
    pagos,
    pagoSeleccionadoId, setPagoSeleccionadoId,
    ordenanteNombre, setOrdenanteNombre,
    ordenanteRfc, setOrdenanteRfc,
    bloqueo,
    bloqueoPermiso,
    puedeOperar,
    bloqueoOrdenanteActual,
    yaReasignado,
    repEnCurso,
    cancelandoFactura: cancelarFactura.isPending,
    accionPendiente,
    handleCancelarRep,
    handleCancelarOriginal,
    handleIrABorrador,
    handleContinuar,
  };
}

export type RefacturarWizard = ReturnType<typeof useRefacturarWizard>;
