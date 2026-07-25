/**
 * Hooks de timbrado / cancelación del REP (Complemento de Pagos).
 * v13.312.26 (QW2 Tanda 1) — al timbrar, se dispara auto-envío por correo al
 * contacto principal del cliente vía `facturapi-enviar-email` en modo
 * fire-and-forget: fallar el correo NO revierte el timbrado y sólo emite un
 * toast informativo.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirRep, cancelarRep, type MotivoCancelacionSat } from "@/features/facturacion/services/repFacturapi";
import { notifyError, notifyInfo } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";
import { supabase } from "@/integrations/supabase/client";

async function autoEnviarRepPorCorreo(pagoId: string): Promise<void> {
  const { data: pago, error: pagoErr } = await supabase
    .from("pagos_factura")
    .select("id, factura_id")
    .eq("id", pagoId)
    .maybeSingle();
  if (pagoErr || !pago?.factura_id) return;

  const { data: factura, error: factErr } = await supabase
    .from("facturas")
    .select("cliente_id")
    .eq("id", pago.factura_id)
    .maybeSingle();
  if (factErr || !factura?.cliente_id) return;

  const { data: contactos, error: cErr } = await supabase
    .from("contactos_cliente")
    .select("email, tipo")
    .eq("cliente_id", factura.cliente_id)
    .not("email", "is", null)
    .is("deleted_at", null);
  if (cErr || !contactos || contactos.length === 0) return;
  // Preferir contacto de facturación/administración; si no, tomar el primero con email.
  const preferido = contactos.find((c) => c.tipo === "facturacion" || c.tipo === "administracion")
    ?? contactos[0];
  const email = preferido?.email;
  if (!email) return;

  await supabase.functions.invoke("facturapi-enviar-email", {
    body: { pago_id: pagoId, email },
  });
}

export function useTimbrarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirRep,
    mutationFn: (pagoId: string) => emitirRep(pagoId),
    onSuccess: (res, pagoId) => {
      toast.success(`REP timbrado · UUID ${res.uuid.slice(0, 8)}…`);
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
      invalidateProfitDependencies(qc);
      // Fire-and-forget: no bloquea la UI ni revierte el timbrado si falla.
      void autoEnviarRepPorCorreo(pagoId).catch((err: unknown) => {
        notifyInfo(undefined, {
          title: "REP timbrado, pero no se pudo auto-enviar por correo",
          description: err instanceof Error ? err.message : undefined,
        });
      });
    },
    onError: (err: Error) => notifyError(toast, {
      title: `No se pudo timbrar el REP: ${err.message}`,
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_1",
    }),
  });
}

export function useCancelarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.cancelarRep,
    mutationFn: (vars: { pagoId: string; motivo: MotivoCancelacionSat; sustituyeUuid?: string }) =>
      cancelarRep(vars.pagoId, vars.motivo, vars.sustituyeUuid),
    onSuccess: () => {
      toast.success("REP cancelado");
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
      invalidateProfitDependencies(qc);
    },
    onError: (err: Error) => notifyError(toast, {
      title: `No se pudo cancelar el REP: ${err.message}`,
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_2",
    }),
  });
}
