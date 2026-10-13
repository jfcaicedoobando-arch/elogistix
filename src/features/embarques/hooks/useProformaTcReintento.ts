import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import type { Tables } from "@/integrations/supabase/types";

interface Entrada {
  open: boolean;
  embarque: Tables<"embarques">;
  guardarTc: (tc: number) => Promise<boolean>;
  confirmar: (embarque: Tables<"embarques">) => Promise<void>;
}

/** Una espera de TC no conserva crédito, selección ni contexto de un render viejo. */
export function useProformaTcReintento(entrada: Entrada) {
  const { open, embarque } = entrada;
  const contexto = useMemo(() => ({ open, embarqueId: embarque.id,
    clienteId: embarque.cliente_id, organizationId: embarque.organization_id }),
  [open, embarque.id, embarque.cliente_id, embarque.organization_id]);
  const vigente = useRef<{ entrada: Entrada; contexto: typeof contexto } | null>(null);
  useLayoutEffect(() => {
    vigente.current = { entrada, contexto };
    return () => { vigente.current = null; };
  }, [entrada, contexto]);

  return useCallback(async (tc: number) => {
    const inicio = vigente.current;
    if (!inicio?.entrada.open) return;
    const scope = captureAuthOperationScope();
    const ok = await inicio.entrada.guardarTc(tc);
    const actual = vigente.current;
    // No trasladar una confirmación a otro cliente/org o a un diálogo reabierto.
    if (!ok || !actual || actual.contexto !== inicio.contexto || !scope.isCurrent()) return;
    await actual.entrada.confirmar({ ...actual.entrada.embarque, tipo_cambio_usd: tc });
  }, []);
}
