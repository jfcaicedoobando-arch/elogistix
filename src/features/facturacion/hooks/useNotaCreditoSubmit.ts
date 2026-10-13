/**
 * Submit del borrador de nota de crédito: mutación de creación, invalidaciones,
 * timbrado opcional, avisos al usuario y cierre SÓLO tras éxito.
 *
 * Recibe el input ya construido por la política pura (`construirInputNC`), no
 * lee el estado del formulario.
 */
import { useState } from "react";
import { useFacturaAsyncScope } from "./useFacturaAsyncScope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import {
  crearNotaCredito,
  type CrearNotaCreditoInput,
} from "@/features/facturacion/services/notasCredito";
import { useTimbrarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { logger } from "@/lib/observability/logger";

interface Params {
  facturaId: string;
  open?: boolean;
  onOpenChange: (o: boolean) => void;
}

export interface NotaCreditoSubmit {
  guardando: boolean;
  /**
   * @param construirInput arma el input; puede lanzar (p. ej. TC inválido).
   * @param timbrarAhora timbra la NC recién creada antes de cerrar.
   */
  enviar: (construirInput: () => CrearNotaCreditoInput, timbrarAhora: boolean) => Promise<void>;
}

export function useNotaCreditoSubmit(p: Params): NotaCreditoSubmit {
  const { toast } = useToast();
  const qc = useQueryClient();
  const timbrar = useTimbrarNotaCredito(p.facturaId);
  const { scope, capturar } = useFacturaAsyncScope(p.facturaId, p.open);
  const [enCurso, setEnCurso] = useState<typeof scope | null>(null);
  const guardando = enCurso === scope;

  const crearMut = useMutation({
    // El input se construye DENTRO de la mutación: si la política lanza (p. ej.
    // TC no disponible) el fallo queda registrado igual que cualquier otro.
    mutationFn: (v: { construir: () => CrearNotaCreditoInput; facturaId: string }) => crearNotaCredito(v.construir()),
    onSuccess: (_nota, v) => {
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(v.facturaId) });
      qc.invalidateQueries({ queryKey: facturasKeys.notasCreditoRecientes() });
    },
    onError: (err) => {
      logger.warn("useNotaCreditoDraft", "crearNotaCredito failed", getErrorMessage(err));
    },
  });

  const enviar = async (
    construirInput: () => CrearNotaCreditoInput,
    timbrarAhora: boolean,
  ): Promise<void> => {
    const vigente = capturar();
    if (!vigente()) return;
    setEnCurso(scope);
    try {
      // Fase 1: crear el borrador. Si falla, el modal se queda abierto y NO
      // existe nota; es seguro reintentar.
      let nueva;
      try {
        nueva = await crearMut.mutateAsync({ construir: construirInput, facturaId: p.facturaId });
      } catch (err) {
        // YG-05: el usuario nunca ve el código crudo `LC_*` (jerga interna).
        const rawMsg = err instanceof Error ? err.message : String(err ?? "");
        logger.warn("useNotaCreditoDraft", "handleSubmit failed", rawMsg);
        notifyError(undefined, {
          title: "No se pudo crear la nota de crédito",
          description: getErrorMessage(err),
          error: err,
          method: "FACTURACION_CREAR_NOTA_CREDITO",
          context: { facturaId: p.facturaId },
        });
        return;
      }
      if (!vigente()) return;
      toast({
        title: "Borrador de nota de crédito creado",
        description: timbrarAhora
          ? "Se timbrará ahora y FacturAPI asignará el folio fiscal."
          : "El folio fiscal se asignará al timbrar.",
      });
      // Fase 2: timbrar la MISMA nota recién creada. Si falla, el borrador ya
      // existe: no se vuelve a crear ni se muestra el error genérico de
      // creación (useTimbrarNotaCredito ya reporta el fallo de timbrado). Se
      // cierra para impedir un borrador duplicado; el reintento se hace desde
      // la lista.
      if (timbrarAhora) {
        try {
          await timbrar.mutateAsync(nueva.id);
        } catch (err) {
          logger.warn(
            "useNotaCreditoDraft",
            "timbrar tras crear failed; borrador conservado",
            err instanceof Error ? err.message : String(err ?? ""),
          );
        }
      }
      if (vigente()) p.onOpenChange(false);
    } finally {
      if (vigente()) setEnCurso((actual) => actual === scope ? null : actual);
    }
  };

  return { guardando, enviar };
}
