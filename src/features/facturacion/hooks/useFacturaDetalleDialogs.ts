/** Estado de diálogos ligado a la identidad y vigencia de su factura. */
import { useState, type SetStateAction } from "react";
import { esFacturaVigenteParaOperar } from "../domain/facturaVigencia";
import type { FacturaDetalle } from "../types/detalle";

type FacturaScope = Pick<FacturaDetalle, "id" | "organization_id" | "deleted_at">;
const cerrados = {
  pagoOpen: false, timbrarOpen: false, enviarOpen: false,
  sustituirOpen: false, cancelarOpen: false, eliminarOpen: false,
  consultarOpen: false, recordatorioOpen: false, refacturarOpen: false,
};
type Dialogo = keyof typeof cerrados;

export function useFacturaDetalleDialogs(factura: FacturaScope | null | undefined) {
  const vigente = esFacturaVigenteParaOperar(factura);
  const destino = JSON.stringify([factura?.organization_id, factura?.id, vigente]);
  const [estado, setEstado] = useState(() => ({ destino, generacion: {}, abiertos: cerrados }));
  // Ajuste durante el render del mismo componente: descarta el bundle antes de
  // pintar otra entidad o reabrir tras recuperar vigencia. No hay frame editable.
  if (estado.destino !== destino) {
    setEstado({ destino, generacion: {}, abiertos: cerrados });
  }
  const crearSetter = (dialogo: Dialogo) => (valor: SetStateAction<boolean>) => {
    setEstado((actual) => {
      if (actual.generacion !== estado.generacion) return actual;
      const abierto = typeof valor === "function" ? valor(actual.abiertos[dialogo]) : valor;
      if (abierto && !vigente) return actual;
      return { ...actual, abiertos: { ...actual.abiertos, [dialogo]: abierto } };
    });
  };
  const setPagoOpen = crearSetter("pagoOpen");
  const setTimbrarOpen = crearSetter("timbrarOpen");
  const setEnviarOpen = crearSetter("enviarOpen");
  const setSustituirOpen = crearSetter("sustituirOpen");
  const setCancelarOpen = crearSetter("cancelarOpen");
  const setEliminarOpen = crearSetter("eliminarOpen");
  const setConsultarOpen = crearSetter("consultarOpen");
  const setRecordatorioOpen = crearSetter("recordatorioOpen");
  const setRefacturarOpen = crearSetter("refacturarOpen");

  return {
    ...estado.abiertos,
    setPagoOpen, setTimbrarOpen, setEnviarOpen, setSustituirOpen, setCancelarOpen,
    setEliminarOpen, setConsultarOpen, setRecordatorioOpen, setRefacturarOpen,
    openPago: () => setPagoOpen(true),
    openTimbrar: () => setTimbrarOpen(true),
    openEnviar: () => setEnviarOpen(true),
    openSustituir: () => setSustituirOpen(true),
    openCancelar: () => setCancelarOpen(true),
    openEliminar: () => setEliminarOpen(true),
    openConsultar: () => setConsultarOpen(true),
    openRecordatorio: () => setRecordatorioOpen(true),
    openRefacturar: () => setRefacturarOpen(true),
  };
}
