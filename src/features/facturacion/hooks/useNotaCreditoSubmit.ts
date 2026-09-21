/**
 * Submit del borrador de nota de crédito: mutación de creación, invalidaciones,
 * timbrado opcional, avisos al usuario y cierre SÓLO tras éxito.
 *
 * Recibe el input ya construido por la política pura (`construirInputNC`), no
 * lee el estado del formulario.
 */
import { useState } from "react";
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
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { logger } from "@/lib/observability/logger";

interface Params {
  facturaId: string;
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
  const [guardando, setGuardando] = useState(false);

  const crearMut = useMutation({
    mutationFn: (input: CrearNotaCreditoInput) => crearNotaCredito(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(p.facturaId) });
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
    setGuardando(true);
    try {
      const nueva = await crearMut.mutateAsync(construirInput());
      toast({
        title: "Borrador de nota de crédito creado",
        description: timbrarAhora
          ? "Se timbrará ahora y FacturAPI asignará el folio fiscal."
          : "El folio fiscal se asignará al timbrar.",
      });
      if (timbrarAhora) await timbrar.mutateAsync(nueva.id);
      p.onOpenChange(false);
    } catch (err) {
      // YG-05: el usuario nunca ve el código crudo `LC_*` (jerga interna).
      const rawMsg = err instanceof Error ? err.message : String(err ?? "");
      logger.warn("useNotaCreditoDraft", "handleSubmit failed", rawMsg);
      notifyError(undefined, {
        title: "No se pudo crear la nota de crédito",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    } finally {
      setGuardando(false);
    }
  };

  return { guardando, enviar };
}
