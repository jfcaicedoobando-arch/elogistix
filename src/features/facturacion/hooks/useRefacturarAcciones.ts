/**
 * Acciones del asistente de refacturación (cancelar REP, consultar REP,
 * cancelar el CFDI original, avanzar/cerrar el caso). Se separa de
 * `useRefacturarWizard` para respetar los límites de líneas y complejidad.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const handleCancelarOriginal = () => {
    if (!p.facturaId || !p.puedeOperar) return;
    const nuevaId = p.s.caso?.factura_nueva_id ?? null;
    const usarSustitucion = p.rutaFiscal === "01" && Boolean(nuevaId);
    cancelarFactura.mutate(
      usarSustitucion
        ? { facturaId: p.facturaId, motivo: "01", sustituidaPorFacturaId: nuevaId! }
        : { facturaId: p.facturaId, motivo: "02" },
      { onSettled: () => p.s.refrescar() },
    );
  };

  const handleIrABorrador = (nuevaId: string) => {
    p.onClose();
    navigate(`/facturacion/${nuevaId}?accion=timbrar`);
  };

  const cerrarCaso = () => p.s.cerrar.mutate(false, { onSuccess: p.onClose });

  const handleContinuar = () => {
    if (p.bloqueo) return;
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
      });
    } else if (accion.tipo === "avanzar") {
      p.s.avanzar.mutate(accion.paso);
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
        { onSuccess: cerrarCaso },
      );
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
