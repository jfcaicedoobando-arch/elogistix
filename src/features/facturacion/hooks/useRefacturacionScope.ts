/** Tokens por apertura/caso/tenant; cancelar UI no revierte una RPC ya enviada. */
import { useLayoutEffect, useMemo, useRef } from "react";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import type { EstadoFacturaNueva } from "../domain/refacturacionNuevaVigencia";

export interface OperacionRefacturacion {
  isCurrent: () => boolean;
  assertCurrent: () => void;
}
interface Contexto {
  facturaId: string | null;
  casoId: string | undefined;
  nuevaId: string | null | undefined;
  open: boolean;
  estado: EstadoFacturaNueva;
  leerContexto: () => { casoId?: string; nuevaId?: string | null; estado: EstadoFacturaNueva; lista: boolean };
}
export function useRefacturacionScope({ facturaId, casoId, nuevaId, open, estado, leerContexto }: Contexto) {
  const auth = captureAuthDataScope();
  const bloqueada = !["vigente", "sin_referencia", "verificando"].includes(estado);
  const scope = useMemo(() => ({ facturaId, casoId, nuevaId, open, generation: auth.generation, bloqueada }),
    [facturaId, casoId, nuevaId, open, auth.generation, bloqueada]);
  const actual = useRef<{ activo: boolean; scope: typeof scope; estado: EstadoFacturaNueva } | null>(null);
  useLayoutEffect(() => {
    const ciclo = { activo: scope.open, scope, estado: "verificando" as EstadoFacturaNueva };
    actual.current = ciclo;
    return () => { ciclo.activo = false; };
  }, [scope]);
  useLayoutEffect(() => { if (actual.current) actual.current.estado = estado; }, [estado, scope]);
  return (permitidos?: readonly EstadoFacturaNueva[], exigirTimbrada = false): OperacionRefacturacion => {
    const ciclo = actual.current;
    const inicioPermitido = !permitidos || permitidos.includes(leerContexto().estado);
    const contextoVigente = () => {
      const consulta = leerContexto();
      return consulta.casoId === scope.casoId && consulta.nuevaId === scope.nuevaId
        && (!exigirTimbrada || consulta.lista)
        && (!permitidos || permitidos.includes(consulta.estado) || consulta.estado === "verificando");
    };
    const isCurrent = () => ciclo?.activo === true && actual.current === ciclo
      && ciclo.scope === scope && auth.isCurrent() && inicioPermitido && contextoVigente();
    return { isCurrent, assertCurrent: () => {
      if (!isCurrent()) throw new Error("El contexto o la vigencia cambió. Actualiza el estado antes de continuar.");
    } };
  };
}
