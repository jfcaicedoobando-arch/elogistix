/**
 * Controlador de página de "Nueva cotización" (paso 6 auditoría).
 *
 * Extrae de `NuevaCotizacion.tsx` toda la coordinación superior: título del
 * documento, navegación y `?oportunidad=`, identidad/organización/permisos,
 * catálogo de clientes, instanciación explícita de las cuatro mutaciones,
 * estado del success dialog y de la plantilla, `onFinalized` + limpieza del
 * borrador, wizard, restauración de borrador (reutiliza `useDraftRestore`,
 * que NO se modifica), prefill del CRM y autoguardado/conflicto.
 *
 * La ruta queda sólo como composición/render. Sin cambios funcionales:
 * mismas reglas del sello, mismas rutas y mismos textos.
 */
import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast, usePermissions, useRegistrarActividad, useDocumentTitle } from "@/hooks/shared";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useClientesForSelect } from "@/features/cliente/hooks";
import {
  useCreateCotizacion,
  useUpdateCotizacion,
  useUpsertCotizacionCostos,
  useCotizacionWizardForm,
} from "@/features/cotizacion/hooks";
import {
  useCotizacionDraftAutosave,
  clearDraft,
} from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { usePrefillProspectoOportunidad } from "@/features/cotizacion/hooks/wizard/usePrefillProspectoOportunidad";
import { useDraftRestore } from "./useDraftRestore";

export function useNuevaCotizacionPageController() {
  useDocumentTitle("Nueva cotización");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // CRM-COT-01: llegada desde una oportunidad de prospecto del CRM.
  const oportunidadPrefill = searchParams.get("oportunidad");
  const { toast } = useToast();
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();
  const { canCrearEmbarqueDesdeCotizacion } = usePermissions();
  const { data: clientes = [] } = useClientesForSelect();
  const userId = user?.id ?? "";

  // P2 (v13.295.0) — Guardar como plantilla desde el success dialog.
  const [guardarPlantillaOpen, setGuardarPlantillaOpen] = useState(false);

  // P0 — Success dialog post-guardado.
  const [savedId, setSavedId] = useState<string | null>(null);
  const handleFinalized = useCallback((id: string) => {
    setSavedId(id);
    clearDraft(userId, organizationId);
  }, [userId, organizationId]);

  // Mutaciones en variables nominales (no hooks anidados en el object literal).
  const crearCotizacion = useCreateCotizacion();
  const updateCotizacion = useUpdateCotizacion();
  const upsertCostos = useUpsertCotizacionCostos();
  const registrarActividad = useRegistrarActividad();

  const w = useCotizacionWizardForm({
    navigate,
    toast,
    userEmail: user?.email ?? "",
    clientes,
    mutations: { crearCotizacion, updateCotizacion, upsertCostos, registrarActividad },
    onFinalized: handleFinalized,
  });

  const {
    restaurando, draftDetectado, banderaBorrador, conflictoSello, permitePrefillProspecto,
    resincronizando, handleResincronizar, handleRestore, handleDiscard,
  } = useDraftRestore({
    form: w.form,
    userId,
    organizationId,
    setCotizacionId: w.setCotizacionId,
    setCurrentStep: w.setCurrentStep,
    setCostosInternos: w.setCostosInternos,
    resincronizarSello: w.resincronizarSello,
  });

  // CRM-COT-01: sólo se precarga si no hay borrador vivo ni cotización creada,
  // para no reemplazar en silencio lo que el usuario ya tenía capturado.
  usePrefillProspectoOportunidad({
    form: w.form,
    oportunidadId: oportunidadPrefill,
    enabled: Boolean(oportunidadPrefill) && permitePrefillProspecto && !w.cotizacionId,
  });

  // B-003 (v13.320.32) — Autoguardado persiste `cotizacionId` en el draft para
  // que recargar el wizard NO duplique la cotización. Sólo se apaga en modo
  // edición (initialData) — aquí siempre es alta, así que enabled=true.
  const { flush: flushDraft, conflictoExterno, descartarConflicto } = useCotizacionDraftAutosave({
    form: w.form,
    userId,
    organizationId,
    enabled: true,
    cotizacionId: w.cotizacionId,
    currentStep: w.currentStep,
    costosInternos: w.costosInternos,
    // v13.823.69: el borrador guarda el sello optimista vigente.
    selloActual: w.selloActual,
    paused: restaurando,
  });

  const closeSuccessAndGoTo = useCallback((to: string) => {
    setSavedId(null);
    navigate(to);
  }, [navigate]);

  const cerrarSuccess = useCallback(() => setSavedId(null), []);

  const recargarPorConflictoSello = useCallback(() => {
    navigate(w.cotizacionId ? `/cotizaciones/${w.cotizacionId}/editar` : "/cotizaciones");
  }, [navigate, w.cotizacionId]);

  const irAlListado = useCallback(() => navigate("/cotizaciones"), [navigate]);

  return {
    w,
    clientes,
    organizationId,
    userId,
    canCrearEmbarqueDesdeCotizacion,
    // Borrador / conflictos
    draftDetectado,
    banderaBorrador,
    handleRestore,
    handleDiscard,
    conflictoExterno,
    descartarConflicto,
    conflictoSello,
    resincronizando,
    handleResincronizar,
    recargarPorConflictoSello,
    flushDraft,
    // Success dialog + plantilla
    savedId,
    cerrarSuccess,
    closeSuccessAndGoTo,
    guardarPlantillaOpen,
    setGuardarPlantillaOpen,
    irAlListado,
  };
}
