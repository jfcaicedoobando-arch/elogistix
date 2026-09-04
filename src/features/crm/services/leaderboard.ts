import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

// FIX C3 (S6-08): cap explícito verificado por assertNotTruncated.
const LIMITE_OPS_MES = 5000;

export interface LeaderboardRow {
  vendedor: string;
  /** Nunca se mezclan monedas: cada fila representa un vendedor+moneda. */
  moneda: string;
  cuota: number;
  cerrado: number;
  avance: number;
}

export interface LeaderboardRawData {
  cuotas: Array<{ vendedor_email: string | null; cuota_monto: number | null; moneda?: string | null }>;
  ops: Array<{
    vendedor_email: string | null;
    valor_real: number | null;
    monto_estimado: number | null;
    etapa_id: string;
    moneda?: string | null;
  }>;
  etapas: Array<{ id: string; tipo: string }>;
}

export async function fetchLeaderboardRaw(
  anio: number,
  mes: number,
  inicioMesISO: string,
  finMesISO: string,
): Promise<LeaderboardRawData> {
  const [cuotasR, opsR, etapasR] = await Promise.all([
    supabase
      .from("crm_cuotas_vendedor")
      .select("vendedor_email, cuota_monto, moneda, anio, mes")
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("crm_oportunidades")
      .select("vendedor_email, valor_real, monto_estimado, moneda, etapa_id, fecha_cierre_real")
      .is("deleted_at", null)
      .gte("fecha_cierre_real", inicioMesISO)
      // FIX-3 (auditoría): límite superior EXCLUSIVO — sin esto se colaban
      // cierres con fecha futura en el leaderboard del mes en curso.
      .lt("fecha_cierre_real", finMesISO)
      .limit(LIMITE_OPS_MES), // defensivo: oportunidades cerradas del mes por org
    supabase.from("crm_etapas_pipeline").select("id, tipo").is("deleted_at", null),
  ]);
  if (cuotasR.error) throw cuotasR.error;
  if (opsR.error) throw opsR.error;
  if (etapasR.error) throw etapasR.error;
  assertNotTruncated(opsR.data, LIMITE_OPS_MES, "crm.leaderboard.oportunidades");
  return {
    cuotas: (cuotasR.data ?? []) as LeaderboardRawData["cuotas"],
    ops: (opsR.data ?? []) as LeaderboardRawData["ops"],
    etapas: (etapasR.data ?? []) as LeaderboardRawData["etapas"],
  };
}

/**
 * Lógica pura, testeable: agrega cuotas/ops por vendedor y moneda (sin
 * mezclar monedas distintas: no hay TC histórico canónico) y calcula avance.
 */
export function computeLeaderboard(raw: LeaderboardRawData): LeaderboardRow[] {
  const tipoEtapa = new Map(raw.etapas.map((e) => [e.id, e.tipo]));
  const cerradoMap = new Map<string, number>(); // key = `${vendedor}|${moneda}`
  for (const o of raw.ops) {
    if (tipoEtapa.get(o.etapa_id) !== "ganada") continue;
    const vendedor = o.vendedor_email || "Sin asignar";
    const moneda = o.moneda || "MXN";
    const monto = Number(o.valor_real ?? o.monto_estimado ?? 0);
    const k = `${vendedor}|${moneda}`;
    cerradoMap.set(k, (cerradoMap.get(k) ?? 0) + monto);
  }
  const cuotaMap = new Map<string, number>();
  for (const c of raw.cuotas) {
    const vendedor = c.vendedor_email || "Sin asignar";
    const moneda = c.moneda || "MXN";
    const k = `${vendedor}|${moneda}`;
    cuotaMap.set(k, (cuotaMap.get(k) ?? 0) + Number(c.cuota_monto ?? 0));
  }
  const todasLasClaves = new Set<string>([...cerradoMap.keys(), ...cuotaMap.keys()]);
  const filas: LeaderboardRow[] = Array.from(todasLasClaves).map((k) => {
    const [vendedor, moneda] = k.split("|");
    const cuota = cuotaMap.get(k) ?? 0;
    const cerrado = cerradoMap.get(k) ?? 0;
    const avance = cuota > 0 ? Math.min(100, Math.round((cerrado / cuota) * 100)) : 0;
    return { vendedor, moneda, cuota, cerrado, avance };
  });
  return filas.sort((a, b) => a.moneda.localeCompare(b.moneda) || b.cerrado - a.cerrado);
}
