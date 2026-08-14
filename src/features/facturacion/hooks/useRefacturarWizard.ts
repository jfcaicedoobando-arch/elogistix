/**
 * Controlador del asistente de refacturación: reúne el caso persistido, el
 * formulario del paso 1, la cancelación de REP/factura y las validaciones por
 * etapa. Se separa del componente para respetar el límite de 200 líneas.
 */
import { useEffect, useMemo, useState } from "react";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { motivoBloqueoRefacturacion } from "@/features/facturacion/domain/refacturacionPermisos";
import { useRefacturacion } from "@/features/facturacion/hooks/useRefacturacion";
import { useClientesFiscalOpts } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import { useRefacturarAcciones } from "@/features/facturacion/hooks/useRefacturarAcciones";
import {
  mapearPagos,
  nombreClienteDestino,
  ordenanteSugerido,
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
  const { organizationId } = useOrgActiva();
  const { role } = usePermissions();
  // Espejo del guard `_assert_refacturador`: sólo roles contables y de
  // administración operan; los demás quedan en modo consulta.
  const bloqueoPermiso = motivoBloqueoRefacturacion(role as AppRole | null);
  const puedeOperar = !bloqueoPermiso;
  const s = useRefacturacion(facturaId, open);
  const clientesQuery = useClientesFiscalOpts(organizationId ?? null, open);

  const [clienteDestinoId, setClienteDestinoId] = useState<string | null>(null);
  const [rutaFiscal, setRutaFiscal] = useState<RutaFiscalRefacturacion>("02");
  const [motivo, setMotivo] = useState("");
  const [pagoSeleccionadoId, setPagoSeleccionadoId] = useState<string | null>(null);
  const [ordenanteNombre, setOrdenanteNombre] = useState("");
  const [ordenanteRfc, setOrdenanteRfc] = useState("");
  const [ordenanteTocado, setOrdenanteTocado] = useState(false);

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

  const acciones = useRefacturarAcciones({
    facturaId,
    s,
    puedeOperar,
    rutaFiscal,
    motivo,
    clienteDestinoId,
    pagoSeleccionadoId,
    yaReasignado,
    bloqueo,
    ordenanteNombre,
    ordenanteRfc,
    onClose,
  });

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
    ordenanteNombre, setOrdenanteNombre: cambiarOrdenanteNombre,
    ordenanteRfc, setOrdenanteRfc: cambiarOrdenanteRfc,
    ordenanteAuto,
    bloqueo,
    aviso,
    bloqueoPermiso,
    puedeOperar,
    bloqueoOrdenanteActual,
    yaReasignado,
    accionPendiente,
    ...acciones,
  };
}

export type RefacturarWizard = ReturnType<typeof useRefacturarWizard>;
