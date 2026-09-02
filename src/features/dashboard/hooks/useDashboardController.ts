/**
 * Controller del Dashboard: agrega `useDashboardData`, gestiona scope `mios|todos`
 * (filtra por operador) y derivaciones de KPIs/fecha. Extraído de la página
 * (Auditoría Paso 6).
 */
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared";
import { useDashboardData, ESTADOS_FILTRO } from "@/features/dashboard/hooks";
import { formatFechaLarga } from "@/lib/formatters/dates";
import { saludoMx } from "@/lib/ui/saludo";


export type DashboardScope = "todos" | "mios";

// v13.380.1 — Alineado con el RPC: post-arribo incluye EIR, Por liquidar y Cerrado.
const ESTADOS_LLEGADO = ["Arribo", "En Aduana", "Entregado", "EIR", "Por liquidar", "Cerrado"] as const;

function getSaludo(): string {
  return saludoMx();
}


function firstName(email: string | null | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getHoyStr(): string {
  return formatFechaLarga(new Date());
}

export function useDashboardController() {
  const { user } = useAuth();
  const { isOperador, canViewFinancials, role } = usePermissions();
  const showScopeToggle = isOperador || role === "vendedor";
  const [scope, setScope] = useState<DashboardScope>(showScopeToggle ? "mios" : "todos");

  const data = useDashboardData();
  const operadorEmail = user?.email ?? "";

  const scoped = useMemo(() => {
    if (scope === "todos") {
      return {
        alertasDemora: data.alertasDemora,
        proximosArribos: data.proximosArribos,
        profitArribosEsteMes: data.profitArribosEsteMes,
        embarquesMesSiguiente: data.embarquesMesSiguiente,
        conteoPorEstado: data.conteoPorEstado,
        totalActivos: data.totalActivos,
        arribosEsteMes: data.arribosEsteMes,
        resumenMesSiguiente: data.resumenMesSiguiente,
      };
    }
    const mine = (op: string | null | undefined) =>
      (op ?? "").toLowerCase() === operadorEmail.toLowerCase();

    const ad = data.alertasDemora.filter((e) => mine(e.operador));
    const pa = data.proximosArribos.filter((e) => mine(e.operador));
    const pf = data.profitArribosEsteMes.filter((e) => mine(e.operador));
    const em = data.embarquesMesSiguiente.filter((e) => mine(e.operador));
    // v13.303.13 · EIR se excluye del CTE `activos` del RPC, por eso viene
    // en su propia lista `embarquesEir`. Sumamos al conteo (no al total activos).
    // v13.380.1 · La lista también trae los embarques en "Por liquidar".
    const eir = data.embarquesEir.filter((e) => mine(e.operador));

    const activos = [...ad, ...pa, ...pf, ...em];
    const seen = new Set<string>();
    const conteo: Record<string, number> = Object.fromEntries(ESTADOS_FILTRO.map((e) => [e, 0]));
    for (const e of activos) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.estadoReal in conteo) conteo[e.estadoReal] += 1;
    }
    // EIR / Por liquidar se cuentan por separado (nunca colisionan con `activos`).
    const eirSeen = new Set<string>();
    for (const e of eir) {
      if (eirSeen.has(e.id)) continue;
      eirSeen.add(e.id);
      if (e.estadoReal in conteo) conteo[e.estadoReal] += 1;
    }


    const arribosScoped = {
      ...data.arribosEsteMes,
      total: pf.length,
      yaLlegaron: pf.filter((e) => (ESTADOS_LLEGADO as readonly string[]).includes(e.estadoReal)).length,
      enCamino: pf.filter((e) => !(ESTADOS_LLEGADO as readonly string[]).includes(e.estadoReal)).length,
    };

    const resumenScoped = {
      ...data.resumenMesSiguiente,
      totalEmbarques: em.length,
      facturados: em.filter((e) => e.facturado).length,
    };

    return {
      alertasDemora: ad,
      proximosArribos: pa,
      profitArribosEsteMes: pf,
      embarquesMesSiguiente: em,
      conteoPorEstado: conteo as typeof data.conteoPorEstado,
      totalActivos: seen.size,
      arribosEsteMes: arribosScoped,
      resumenMesSiguiente: resumenScoped,
    };
  }, [scope, operadorEmail, data]);

  const nombre = firstName(user?.email);
  const { saludo, hoyStr } = useMemo(
    () => ({ saludo: nombre ? `${getSaludo()}, ${nombre}` : getSaludo(), hoyStr: getHoyStr() }),
    [nombre],
  );

  return {
    scope,
    setScope,
    showScopeToggle,
    operadorEmail,
    isOperador,
    canViewFinancials,
    hideFinancials: !canViewFinancials,
    isLoading: data.isLoading,
    isError: data.isError,
    refetch: data.refetch,
    cargasPorCliente: data.cargasPorCliente,
    cargasActivasTotal: data.cargasActivasTotal,
    scoped,
    saludo,
    hoyStr,
  };
}
