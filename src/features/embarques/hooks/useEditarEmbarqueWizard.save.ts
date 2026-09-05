/**
 * Lógica de guardado de useEditarEmbarqueWizard: construye los payloads,
 * calcula el diff para bitácora y ejecuta la mutación. Extraído para que el
 * hook orquestador quede enfocado en el estado de hidratación del wizard.
 */
import type { NavigateFunction } from "react-router-dom";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { getErrorMessage } from "@/lib/errors";
import { diffFields, diffConceptos, SENSITIVE_FIELDS } from "@/features/auditoria/utils/diffFields";
import { validarContenedoresMaritimo, validarRutaMaritimaRequerida, buildBitacoraDetallesEdit } from "./useEditarEmbarqueWizard.helpers";
import type { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";
import type { useConceptosForm } from "@/features/cotizacion/hooks";
import type { useUpdateEmbarque, useEmbarque } from "@/features/embarques/hooks/useEmbarques";
import type { useRegistrarActividad } from "@/hooks/shared";
import type { Tables } from "@/integrations/supabase/types";
import type { ConceptoLike } from "@/features/auditoria/utils/diffFields";

type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;

interface Deps {
  id: string | undefined;
  embarque: ReturnType<typeof useEmbarque>["data"];
  methods: ReturnType<typeof useEmbarqueForm>["methods"];
  buildEmbarquePayload: ReturnType<typeof useEmbarqueForm>["buildEmbarquePayload"];
  buildConceptosVentaPayload: ReturnType<typeof useEmbarqueForm>["buildConceptosVentaPayload"];
  buildConceptosCostoPayload: ReturnType<typeof useEmbarqueForm>["buildConceptosCostoPayload"];
  contactos: ContactoRow[];
  selectedClienteNombre: string | undefined;
  userEmail: string | undefined;
  conceptosVenta: ReturnType<typeof useConceptosForm>["conceptosVenta"];
  conceptosCosto: ReturnType<typeof useConceptosForm>["conceptosCosto"];
  conceptosVentaDb: ConceptoLike[];
  conceptosCostoDb: ConceptoLike[];
  proveedoresDb: { id: string; nombre: string }[];
  updateEmbarque: ReturnType<typeof useUpdateEmbarque>;
  registrarActividad: ReturnType<typeof useRegistrarActividad>;
  setCurrentStep: (step: number) => void;
  navigate: NavigateFunction;
}

export async function ejecutarGuardarEmbarque(deps: Deps): Promise<void> {
  const {
    id, embarque, methods,
    buildEmbarquePayload, buildConceptosVentaPayload, buildConceptosCostoPayload,
    contactos, selectedClienteNombre, userEmail,
    conceptosVenta, conceptosCosto, conceptosVentaDb, conceptosCostoDb, proveedoresDb,
    updateEmbarque, registrarActividad, setCurrentStep, navigate,
  } = deps;
  if (!id || !embarque) return;
  try {
    const contenedoresActuales = methods.getValues('contenedores') ?? [];
    const modoActual = methods.getValues('modo');
    const errContenedores = validarContenedoresMaritimo(modoActual, contenedoresActuales);
    if (errContenedores) {
      notifyError(undefined, {
        title: "Faltan datos de contenedores",
        description: errContenedores.description,
        method: "HANDLE_SAVE",
      });
      setCurrentStep(errContenedores.step);
      return;
    }

    const errRuta = validarRutaMaritimaRequerida(modoActual, {
      naviera: methods.getValues('naviera'),
      tipoServicio: methods.getValues('tipoServicio'),
    });
    if (errRuta) {
      notifyError(undefined, {
        title: "Faltan datos de la ruta",
        description: errRuta.description,
        method: "HANDLE_SAVE",
      });
      setCurrentStep(errRuta.step);
      return;
    }

    const nuevoEmbarquePayload = buildEmbarquePayload(contactos, selectedClienteNombre || '', userEmail || '');
    const nuevosVenta = buildConceptosVentaPayload(conceptosVenta);
    const nuevosCosto = buildConceptosCostoPayload(conceptosCosto, proveedoresDb);

    // Diff de campos sensibles ANTES de mutar (Bloque 3.6 ext).
    const cambiosEmbarque = diffFields(embarque, nuevoEmbarquePayload, SENSITIVE_FIELDS.embarque);
    const cambiosVenta = diffConceptos(conceptosVentaDb, nuevosVenta);
    const cambiosCosto = diffConceptos(conceptosCostoDb, nuevosCosto);

    // v13.823.64: sólo Marítimo/Multimodal sincronizan contenedores hijos. En
    // Aéreo/Terrestre el peso, volumen y piezas se capturan en el embarque; al
    // sincronizar los "contenedores" vacíos que arrastra la conversión desde
    // cotización, el recálculo automático los ponía en cero.
    const sincronizaContenedores = modoActual === "Marítimo" || modoActual === "Multimodal";

    await updateEmbarque.mutateAsync({
      id,
      embarque: nuevoEmbarquePayload,
      conceptosVenta: nuevosVenta,
      conceptosCosto: nuevosCosto,
      contenedores: sincronizaContenedores ? contenedoresActuales : undefined,
      // FIX-15 · Enviamos el `updated_at` que leímos al hidratar el wizard
      // para que la RPC rechace el guardado si alguien más ya guardó.
      expectedUpdatedAt: embarque.updated_at ?? null,
    });


    const v = methods.getValues();
    registrarActividad.mutate({
      accion: 'editar',
      modulo: 'embarques',
      entidad_id: id,
      entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
      detalles: buildBitacoraDetallesEdit({
        clienteNombre: selectedClienteNombre ?? '',
        modo: v.modo,
        tipo: v.tipo,
        cambiosEmbarque,
        cambiosVenta,
        cambiosCosto,
      }),
    });

    notifySuccess(undefined, { title: "Embarque actualizado", description: `${labelExpediente(embarque.expediente, embarque.id)} guardado correctamente.` });
    navigate(`/embarques/${id}`);
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    // FIX-15 · Conflicto de concurrencia: mensaje humano en vez del código crudo.
    if (msg.includes("LC_CONFLICTO_CONCURRENCIA")) {
      notifyError(undefined, {
        title: "Otro usuario modificó este embarque",
        description: "Recarga la página para ver los cambios más recientes y vuelve a guardar.",
        error: err,
        method: "HANDLE_SAVE",
      });
      return;
    }
    notifyError(undefined, { title: "Error al actualizar", description: msg, error: err, method: "HANDLE_SAVE" });
  }
}
