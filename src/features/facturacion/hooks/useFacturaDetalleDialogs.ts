/**
 * Estado local de los 6 diálogos de `FacturaDetalle`. Extraído del route
 * para respetar el límite Power of 10 (≤200 líneas por archivo) y separar
 * presentación de estado de UI.
 */
import { useState } from "react";

export function useFacturaDetalleDialogs() {
  const [pagoOpen, setPagoOpen] = useState(false);
  const [timbrarOpen, setTimbrarOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [sustituirOpen, setSustituirOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [consultarOpen, setConsultarOpen] = useState(false);
  const [recordatorioOpen, setRecordatorioOpen] = useState(false);

  return {
    pagoOpen, setPagoOpen,
    timbrarOpen, setTimbrarOpen,
    enviarOpen, setEnviarOpen,
    sustituirOpen, setSustituirOpen,
    cancelarOpen, setCancelarOpen,
    eliminarOpen, setEliminarOpen,
    consultarOpen, setConsultarOpen,
    recordatorioOpen, setRecordatorioOpen,
    openPago: () => setPagoOpen(true),
    openTimbrar: () => setTimbrarOpen(true),
    openEnviar: () => setEnviarOpen(true),
    openSustituir: () => setSustituirOpen(true),
    openCancelar: () => setCancelarOpen(true),
    openEliminar: () => setEliminarOpen(true),
    openConsultar: () => setConsultarOpen(true),
    openRecordatorio: () => setRecordatorioOpen(true),
  };
}

