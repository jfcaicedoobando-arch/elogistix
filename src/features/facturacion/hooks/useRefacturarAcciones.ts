/**
 * Acciones del asistente de refacturación (cancelar REP, consultar REP,
 * cancelar el CFDI original, avanzar/cerrar el caso). Se separa de
 * `useRefacturarWizard` para respetar los límites de líneas y complejidad.
 */
import { useRef, useState } from "react";
import type { OperacionRefacturacion } from "./useRefacturacionScope";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useNavigate } from "react-router";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useCancelarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import { useConsultarRep } from "@/features/facturacion/hooks/useConsultarRep";
import { decidirAvance } from "@/features/facturacion/domain/refacturarWizardAvance";
import type { useRefacturacion } from "@/features/facturacion/hooks/useRefacturacion";
import type { RutaFiscalRefacturacion } from "@/features/facturacion/services/refacturacion";

type EstadoRefacturacion = ReturnType<typeof useRefacturacion>;

interface Params {
  facturaId: string | null;
  s: EstadoRefacturacion;
  puedeOperar: boolean;
  rutaFiscal: RutaFiscalRefacturacion;
  motivo: string;
  clienteDestinoId: string | null;
  pagoSeleccionadoId: string | null;
  yaReasignado: boolean;
  bloqueo: string | null;
  ordenanteNombre: string;
  ordenanteRfc: string;
  onClose: () => void;
}

export function useRefacturarAcciones(p: Params) {
  const navigate = useNavigate();
  const cancelarFactura = useCancelarFactura();
  const cancelarRep = useCancelarRep(p.facturaId ?? undefined);
  const consultarRep = useConsultarRep(p.facturaId ?? undefined);
  const accionEnCurso = useRef<OperacionRefacturacion | null>(null);
  const [repEnCurso, setRepEnCurso] = useState<string | null>(null);

  const finalizarRep = () => {
    setRepEnCurso(null);
    p.s.refrescar();
  };

  const handleCancelarRep = (pagoId: string) => {
    if (!p.puedeOperar) return;
    setRepEnCurso(pagoId);
    cancelarRep.mutate({ pagoId, motivo: "02" }, { onSettled: finalizarRep });
  };

  /** Refresco manual del estatus del REP ante el SAT (sin esperar el cron). */
  const handleConsultarRep = (pagoId: string) => {
    setRepEnCurso(pagoId);
    consultarRep.mutate(pagoId, { onSettled: finalizarRep });
  };

  const handleCancelarOriginal = async () => {
    if (!p.facturaId || !p.puedeOperar || p.s.estadoFacturaNueva !== "vigente") return;
    if (accionEnCurso.current?.isCurrent()) return;
    const operacion = p.s.capturarOperacion(["vigente"], true);
    if (!operacion.isCurrent()) return;
    accionEnCurso.current = operacion;
    const liberar = () => { if (accionEnCurso.current === operacion) accionEnCurso.current = null; };
    try {
      await p.s.verificarNueva(true, undefined, operacion);
      if (!operacion.isCurrent()) return;
    } catch (error) {
      liberar();
      if (!operacion.isCurrent()) return;
      notifyError(undefined, { title: "No se pudo verificar la nueva factura", description: getErrorMessage(error) });
      p.s.refrescar();
      return;
    }
    const nuevaId = p.s.caso?.factura_nueva_id ?? null;
    const usarSustitucion = p.rutaFiscal === "01" && Boolean(nuevaId);
    cancelarFactura.mutate(
      usarSustitucion
        ? { facturaId: p.facturaId, motivo: "01", sustituidaPorFacturaId: nuevaId! }
        : { facturaId: p.facturaId, motivo: "02" },
      { onSettled: () => { liberar(); p.s.refrescar(); } },
    );
  };

  const handleIrABorrador = async (nuevaId: string) => {
    if (p.s.estadoFacturaNueva !== "vigente" || p.s.caso?.factura_nueva_id !== nuevaId) return;
    if (accionEnCurso.current?.isCurrent()) return;
    const operacion = p.s.capturarOperacion(["vigente"]);
    if (!operacion.isCurrent()) return;
    accionEnCurso.current = operacion;
    try {
      await p.s.verificarNueva(false, nuevaId, operacion);
      if (!operacion.isCurrent()) return;
      p.onClose();
      navigate(`/facturacion/${nuevaId}?accion=timbrar`);
    } catch (error) {
      if (!operacion.isCurrent()) return;
      notifyError(undefined, { title: "No se pudo abrir la nueva factura", description: getErrorMessage(error) });
      p.s.refrescar();
    } finally {
      if (accionEnCurso.current === operacion) accionEnCurso.current = null;
    }
  };

  const handleContinuar = () => {
    if (p.bloqueo || !p.puedeOperar || accionEnCurso.current?.isCurrent()) return;
    const operacion = p.s.capturarOperacion(p.s.paso >= 3 ? ["vigente"] : undefined, p.s.paso >= 3);
    if (!operacion.isCurrent()) return;
    accionEnCurso.current = operacion;
    const liberarAccion = () => { if (accionEnCurso.current === operacion) accionEnCurso.current = null; };
    const cerrarCaso = () => {
      if (operacion.isCurrent()) p.s.cerrar.mutate(false, { onSuccess: p.onClose, onSettled: liberarAccion });
    };
    const accion = decidirAvance({
      paso: p.s.paso,
      facturaId: p.facturaId,
      casoId: p.s.caso?.id ?? null,
      facturaNuevaId: p.s.caso?.factura_nueva_id ?? null,
      clienteDestinoId: p.clienteDestinoId,
      pagoSeleccionadoId: p.pagoSeleccionadoId,
      yaReasignado: p.yaReasignado,
    });
    if (accion.tipo === "abrir") {
      p.s.abrir.mutate({
        facturaId: p.facturaId!,
        clienteDestinoId: p.clienteDestinoId!,
        rutaFiscal: p.rutaFiscal,
        motivo: p.motivo,
      }, { onSettled: liberarAccion });
    } else if (accion.tipo === "avanzar") {
      p.s.avanzar.mutate(accion.paso, { onSettled: liberarAccion });
    } else if (accion.tipo === "cerrar") {
      cerrarCaso();
    } else if (accion.tipo === "reasignar") {
      p.s.reasignar.mutate(
        {
          pagoId: accion.pagoId,
          facturaDestinoId: accion.facturaDestinoId,
          casoId: accion.casoId,
          ordenanteNombre: p.ordenanteNombre,
          ordenanteRfc: p.ordenanteRfc,
        },
        { onSuccess: cerrarCaso, onError: liberarAccion },
      );
    } else {
      liberarAccion();
    }
  };

  return {
    repEnCurso,
    cancelandoFactura: cancelarFactura.isPending,
    consultandoRep: consultarRep.isPending,
    handleCancelarRep,
    handleConsultarRep,
    handleCancelarOriginal,
    handleIrABorrador,
    handleContinuar,
  };
}
