/**
 * Controlador del asistente de refacturación: reúne el caso persistido, el
 * formulario del paso 1, la cancelación de REP/factura y las validaciones por
 * etapa. Se separa del componente para respetar el límite de 200 líneas.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { motivoBloqueoRefacturacion } from "@/features/facturacion/domain/refacturacionPermisos";
import { useRefacturacion } from "@/features/facturacion/hooks/useRefacturacion";
import { useClientesFiscalOpts } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useCancelarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import { useConsultarRep } from "@/features/facturacion/hooks/useConsultarRep";
import { decidirAvance } from "@/features/facturacion/domain/refacturarWizardAvance";
import {
  mapearPagos,
  nombreClienteDestino,
  receptorDesdeClientes,
} from "@/features/facturacion/domain/refacturarWizardDerivados";
import {
  avisoPaso,
  bloqueoPaso,
  type PagoRefacturacion,
} from "@/features/facturacion/domain/refacturacionPasos";

import {
  bloqueoOrdenante as calcularBloqueoOrdenante,
  pendientesReceptorFiscal,
} from "@/features/facturacion/domain/refacturacionValidaciones";
import { useRefacturacionConsistencia } from "@/features/facturacion/hooks/useRefacturacionConsistencia";
import type { RutaFiscalRefacturacion } from "@/features/facturacion/services/refacturacion";
import type { AppRole } from "@/types/appRole";

export function useRefacturarWizard(facturaId: string | null, open: boolean, onClose: () => void) {
  const navigate = useNavigate();
  const { organizationId } = useOrgActiva();
  const { role } = usePermissions();
  // Espejo del guard `_assert_refacturador`: sólo roles contables y de
  // administración operan; los demás quedan en modo consulta.
  const bloqueoPermiso = motivoBloqueoRefacturacion(role as AppRole | null);
  const puedeOperar = !bloqueoPermiso;
  const s = useRefacturacion(facturaId, open);
  const clientesQuery = useClientesFiscalOpts(organizationId ?? null, open);
  const cancelarFactura = useCancelarFactura();
  const cancelarRep = useCancelarRep(facturaId ?? undefined);
  const consultarRep = useConsultarRep(facturaId ?? undefined);

  const [clienteDestinoId, setClienteDestinoId] = useState<string | null>(null);
  const [rutaFiscal, setRutaFiscal] = useState<RutaFiscalRefacturacion>("02");
  const [motivo, setMotivo] = useState("");
  const [pagoSeleccionadoId, setPagoSeleccionadoId] = useState<string | null>(null);
  const [ordenanteNombre, setOrdenanteNombre] = useState("");
  const [ordenanteRfc, setOrdenanteRfc] = useState("");
  const [ordenanteTocado, setOrdenanteTocado] = useState(false);
  const [repEnCurso, setRepEnCurso] = useState<string | null>(null);

  // Al reabrir con un caso vivo, el formulario refleja lo ya decidido.
  useEffect(() => {
    if (!open || !s.caso) return;
    setClienteDestinoId(s.caso.cliente_destino_id);
    setRutaFiscal(s.caso.ruta_fiscal);
    setMotivo(s.caso.motivo);
    setPagoSeleccionadoId((prev) => prev ?? s.caso!.pago_original_id);
  }, [open, s.caso]);

  const pagos: PagoRefacturacion[] = useMemo(() => mapearPagos(s.pagos), [s.pagos]);

  const receptorDestino = useMemo(
    () => receptorDesdeClientes(clientesQuery.data, clienteDestinoId),
    [clientesQuery.data, clienteDestinoId],
  );

  const receptorPendientes = useMemo(
    () => (receptorDestino ? pendientesReceptorFiscal(receptorDestino) : []),
    [receptorDestino],
  );

  // El ordenante real del depósito es el receptor de la factura viva (la nueva):
  // la original y su REP se cancelaron para sustituirse. Se siembra una vez y
  // el usuario puede corregirlo.
  const ordenanteAuto = useMemo(
    () => ordenanteSugerido(s.facturaNueva, receptorDestino),
    [s.facturaNueva, receptorDestino],
  );

  useEffect(() => {
    if (!open || ordenanteTocado || !ordenanteAuto) return;
    setOrdenanteNombre(ordenanteAuto.nombre);
    setOrdenanteRfc(ordenanteAuto.rfc);
  }, [open, ordenanteTocado, ordenanteAuto]);

  const cambiarOrdenanteNombre = (v: string) => {
    setOrdenanteTocado(true);
    setOrdenanteNombre(v);
  };
  const cambiarOrdenanteRfc = (v: string) => {
    setOrdenanteTocado(true);
    setOrdenanteRfc(v);
  };

  const consistenciaQuery = useRefacturacionConsistencia(
    s.caso?.id ?? null,
    open && Boolean(s.caso?.factura_nueva_id) && s.paso >= 3,
  );
  const consistencia = consistenciaQuery.data ?? null;
  const consistenciaHallazgos = (consistencia?.hallazgos ?? []).map((h) => h.mensaje);

  const bloqueoOrdenanteActual = calcularBloqueoOrdenante(ordenanteNombre, ordenanteRfc);
  const yaReasignado = Boolean(s.caso?.pago_nuevo_id);
  const ctxPasos = {
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
  };
  const bloqueo = bloqueoPaso(s.paso, ctxPasos);
  const aviso = avisoPaso(s.paso, ctxPasos);

  const clienteDestinoNombre = nombreClienteDestino(clientesQuery.data, clienteDestinoId);


  const handleCancelarRep = (pagoId: string) => {
    if (!puedeOperar) return;
    setRepEnCurso(pagoId);
    cancelarRep.mutate({ pagoId, motivo: "02" }, {
      onSettled: () => { setRepEnCurso(null); s.refrescar(); },
    });
  };

  /** Refresco manual del estatus del REP ante el SAT (sin esperar el cron). */
  const handleConsultarRep = (pagoId: string) => {
    setRepEnCurso(pagoId);
    consultarRep.mutate(pagoId, {
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
    const accion = decidirAvance({
      paso: s.paso,
      facturaId,
      casoId: s.caso?.id ?? null,
      facturaNuevaId: s.caso?.factura_nueva_id ?? null,
      clienteDestinoId,
      pagoSeleccionadoId,
      yaReasignado,
    });
    if (accion.tipo === "abrir") {
      s.abrir.mutate({ facturaId: facturaId!, clienteDestinoId: clienteDestinoId!, rutaFiscal, motivo });
      return;
    }
    if (accion.tipo === "avanzar") {
      s.avanzar.mutate(accion.paso);
      return;
    }
    if (accion.tipo === "cerrar") {
      s.cerrar.mutate(false, { onSuccess: onClose });
      return;
    }
    if (accion.tipo === "reasignar") {
      s.reasignar.mutate(
        {
          pagoId: accion.pagoId,
          facturaDestinoId: accion.facturaDestinoId,
          casoId: accion.casoId,
          ordenanteNombre,
          ordenanteRfc,
        },
        { onSuccess: () => s.cerrar.mutate(false, { onSuccess: onClose }) },
      );
    }
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
    aviso,
    bloqueoPermiso,
    puedeOperar,
    bloqueoOrdenanteActual,
    yaReasignado,
    repEnCurso,
    cancelandoFactura: cancelarFactura.isPending,
    accionPendiente,
    handleCancelarRep,
    handleConsultarRep,
    consultandoRep: consultarRep.isPending,
    handleCancelarOriginal,
    handleIrABorrador,
    handleContinuar,
  };
}

export type RefacturarWizard = ReturnType<typeof useRefacturarWizard>;
