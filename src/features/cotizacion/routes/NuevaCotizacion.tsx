import CotizacionWizardLayout from "@/features/cotizacion/components/CotizacionWizardLayout";
import { ConflictoPestanaAlert } from "@/features/cotizacion/components/wizard/ConflictoPestanaAlert";
import { ConflictoSelloAlert } from "@/features/cotizacion/components/wizard/ConflictoSelloAlert";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { CotizacionSuccessDialog } from "@/features/cotizacion/components/wizard/CotizacionSuccessDialog";
import { GuardarPlantillaDialog } from "@/features/cotizacion/components/wizard/GuardarPlantillaDialog";
import { PlantillaSelectorPaso1 } from "@/features/cotizacion/components/wizard/PlantillaSelectorPaso1";
import { PageContainer } from "@/components/shared/PageContainer";
import { useNuevaCotizacionPageController } from "./useNuevaCotizacionPageController";

export default function NuevaCotizacion() {
  const {
    w, clientes, organizationId, userId, canCrearEmbarqueDesdeCotizacion,
    draftDetectado, banderaBorrador, handleRestore, handleDiscard,
    conflictoExterno, descartarConflicto,
    conflictoSello, resincronizando, handleResincronizar, recargarPorConflictoSello,
    flushDraft, savedId, cerrarSuccess, closeSuccessAndGoTo,
    guardarPlantillaOpen, setGuardarPlantillaOpen, irAlListado,
  } = useNuevaCotizacionPageController();

  return (
    <>
      {banderaBorrador && draftDetectado && (
        <PageContainer noSpacing className="max-w-6xl pt-4">
          {/* UI-08: wrapper estándar PageContainer (antes div ad-hoc max-w-6xl). */}
          <DraftRestoreBanner
            savedAt={draftDetectado.savedAt}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
          />
        </PageContainer>
      )}

      {conflictoExterno && <ConflictoPestanaAlert onDescartar={descartarConflicto} />}

      {/* v13.823.69: el borrador se restauró pero la cotización ya cambió en
          servidor. Se conserva todo lo capturado y NO se guarda encima. */}
      {conflictoSello && (
        <ConflictoSelloAlert
          onRecargar={recargarPorConflictoSello}
          onResincronizar={handleResincronizar}
          resincronizando={resincronizando}
        />
      )}

      {/* P2 (v13.295.0) — Empezar desde plantilla (sólo paso 1, sin cotización guardada). */}
      {w.currentStep === 1 && !w.cotizacionId && (
        <PlantillaSelectorPaso1
          organizationId={organizationId}
          form={w.form}
        />
      )}

      <CotizacionWizardLayout
        w={w}
        clientes={clientes}
        title="Nueva cotización"
        subtitle="Completa los datos para crear una cotización"
        onBack={irAlListado}
        saveLabel="Guardar cotización"
        onFlushDraft={flushDraft}
      />

      <CotizacionSuccessDialog
        open={!!savedId}
        onOpenChange={(o) => { if (!o) cerrarSuccess(); }}
        folio={null}
        /* R215-COT-01: una cotización recién creada nunca está Aceptada, así que
           el diálogo ofrece "Ver cotización y aceptar" en vez de "Crear embarque". */
        estado={null}
        puedeCrearEmbarqueRol={canCrearEmbarqueDesdeCotizacion}
        onEnviarProforma={() => savedId && closeSuccessAndGoTo(`/cotizaciones/${savedId}?enviarProforma=1`)}
        onCrearEmbarque={() => savedId && closeSuccessAndGoTo(`/embarques/nuevo?fromCotizacion=${savedId}`)}
        onDuplicar={() => savedId && closeSuccessAndGoTo(`/cotizaciones/nueva?duplicar=${savedId}`)}
        onIrAlListado={() => closeSuccessAndGoTo("/cotizaciones")}
        onVerDetalle={() => savedId && closeSuccessAndGoTo(`/cotizaciones/${savedId}`)}
        onGuardarComoPlantilla={() => setGuardarPlantillaOpen(true)}
      />

      <GuardarPlantillaDialog
        open={guardarPlantillaOpen}
        onOpenChange={setGuardarPlantillaOpen}
        organizationId={organizationId}
        usuarioId={userId || null}
        values={w.form.getValues()}
      />
    </>
  );
}
