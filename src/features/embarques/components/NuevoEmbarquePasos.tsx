/**
 * Render de los 4 pasos del wizard de nuevo embarque. Extraído de
 * `NuevoEmbarque.tsx` (Power-of-10: complejidad ≤16); no cambia comportamiento,
 * sólo mueve el switch de pasos fuera del componente de ruta.
 */
import { StepDatosGenerales } from "@/features/embarques/components/StepDatosGenerales";
import { StepDatosRuta } from "@/features/embarques/components/StepDatosRuta";
import { StepDocumentos } from "@/features/embarques/components/StepDocumentos";
import { StepCostosPrecios } from "@/features/embarques/components/StepCostosPrecios";
import type { useNuevoEmbarqueWizard } from "@/features/embarques/hooks";

type Wizard = ReturnType<typeof useNuevoEmbarqueWizard>;

export function NuevoEmbarquePasos({ w }: { w: Wizard }) {
  if (w.currentStep === 1) {
    return (
      <StepDatosGenerales
        clientes={w.clientes}
        clienteNombre={w.selectedCliente?.nombre || ""}
        contactos={w.contactos}
        onMsdsUpload={w.handleMsdsUpload}
        errors={w.validationErrors[1] || {}}
        cotizacionesAceptadas={w.cotizacionesAceptadas}
        cotizacionVinculada={w.cotizacionVinculada}
        onVincularCotizacion={w.handleVincularCotizacion}
        onDesvincularCotizacion={w.handleDesvincularCotizacion}
        modoExpediente={w.modoExpediente}
        onModoExpedienteChange={w.handleModoExpedienteChange}
        expedienteSeleccionado={w.expedienteSeleccionado}
        onSeleccionarExpediente={w.handleSeleccionarExpediente}
      />
    );
  }
  if (w.currentStep === 2) {
    return (
      <StepDatosRuta
        errors={w.validationErrors[2] || {}}
        diasTransitoSugerencia={w.cotizacionVinculada?.tiempo_transito_dias ?? null}
      />
    );
  }
  if (w.currentStep === 3) {
    return (
      <StepDocumentos
        documentos={w.getDocumentosChecklist(w.modo)}
        onFileChange={w.setDocumentoArchivo}
        errors={w.validationErrors[3] || {}}
      />
    );
  }
  if (w.currentStep === 4) {
    return (
      <StepCostosPrecios
        conceptosVenta={w.conceptosVenta}
        conceptosCosto={w.conceptosCosto}
        proveedoresDb={w.proveedoresDb}
        subtotalVenta={w.subtotalVenta}
        totalCosto={w.totalCosto}
        utilidadEstimada={w.utilidadEstimada}
        updateConceptoVenta={w.updateConceptoVenta}
        addConceptoVenta={w.addConceptoVenta}
        removeConceptoVenta={w.removeConceptoVenta}
        updateConceptoCosto={w.updateConceptoCosto}
        addConceptoCosto={w.addConceptoCosto}
        removeConceptoCosto={w.removeConceptoCosto}
        errors={w.validationErrors[4] || {}}
      />
    );
  }
  return null;
}
