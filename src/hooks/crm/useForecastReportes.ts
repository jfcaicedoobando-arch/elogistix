/**
 * Reportes y forecast CRM (Fase 5).
 * Cálculos en el cliente sobre lecturas filtradas por organización (via RLS).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmOportunidadRow } from "./useOportunidades";
import type { CrmLeadRow } from "./useLeads";

interface ForecastBucket {
  key: string;
  label: string;
  pipeline: number;
  ponderado: number;
  ganado: number;
  count: number;
}

export interface ForecastResumen {
  porMes: ForecastBucket[];
  porVendedor: ForecastBucket[];
  totalPipeline: number;
  totalPonderado: number;
  totalGanado: number;
}

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function mesKey(d: string | null): string {
  if (!d) return "Sin fecha";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function mesLabel(k: string): string {
  if (k === "Sin fecha") return k;
  const [y, m] = k.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

export function useForecast(desde?: string, hasta?: string) {
  return useQuery<ForecastResumen>({
    queryKey: ["crm", "forecast", desde, hasta],
    queryFn: async () => {
      let q = supabase
        .from("crm_oportunidades")
        .select(
          "id, monto_estimado, probabilidad, fecha_estimada_cierre, vendedor_email, etapa_id, crm_etapas_pipeline!inner(tipo)",
        );
      if (desde) q = q.gte("fecha_estimada_cierre", desde);
      if (hasta) q = q.lte("fecha_estimada_cierre", hasta);
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        monto_estimado: number;
        probabilidad: number;
        fecha_estimada_cierre: string | null;
        vendedor_email: string;
        crm_etapas_pipeline: { tipo: "abierta" | "ganada" | "perdida" } | null;
      }>;

      const mes = new Map<string, ForecastBucket>();
      const vend = new Map<string, ForecastBucket>();
      let totalPipeline = 0;
      let totalPonderado = 0;
      let totalGanado = 0;

      for (const r of rows) {
        const monto = Number(r.monto_estimado ?? 0);
        const prob = Number(r.probabilidad ?? 0) / 100;
        const ponderado = monto * prob;
        const ganada = r.crm_etapas_pipeline?.tipo === "ganada";
        const abierta = r.crm_etapas_pipeline?.tipo === "abierta";
        if (abierta) {
          totalPipeline += monto;
          totalPonderado += ponderado;
        }
        if (ganada) totalGanado += monto;

        const mk = mesKey(r.fecha_estimada_cierre);
        const mb = mes.get(mk) ?? { key: mk, label: mesLabel(mk), pipeline: 0, ponderado: 0, ganado: 0, count: 0 };
        mb.count += 1;
        if (abierta) { mb.pipeline += monto; mb.ponderado += ponderado; }
        if (ganada) mb.ganado += monto;
        mes.set(mk, mb);

        const vk = r.vendedor_email || "Sin asignar";
        const vb = vend.get(vk) ?? { key: vk, label: vk, pipeline: 0, ponderado: 0, ganado: 0, count: 0 };
        vb.count += 1;
        if (abierta) { vb.pipeline += monto; vb.ponderado += ponderado; }
        if (ganada) vb.ganado += monto;
        vend.set(vk, vb);
      }

      return {
        porMes: Array.from(mes.values()).sort((a, b) => a.key.localeCompare(b.key)),
        porVendedor: Array.from(vend.values()).sort((a, b) => b.ponderado - a.ponderado),
        totalPipeline,
        totalPonderado,
        totalGanado,
      };
    },
  });
}

export interface ReportesCRM {
  embudo: { etapa: string; cantidad: number }[];
  porFuente: { fuente: string; total: number; convertidos: number; tasa: number }[];
  motivosPerdida: { motivo: string; cantidad: number }[];
}

export function useReportesCRM() {
  return useQuery<ReportesCRM>({
    queryKey: ["crm", "reportes"],
    queryFn: async () => {
      const [leadsR, opsR, motivosR] = await Promise.all([
        supabase.from("crm_leads").select("estado, fuente"),
        supabase.from("crm_oportunidades").select("motivo_perdida_id, etapa_id, crm_etapas_pipeline!inner(nombre, tipo)"),
        supabase.from("crm_motivos_perdida").select("id, nombre"),
      ]);
      if (leadsR.error) throw leadsR.error;
      if (opsR.error) throw opsR.error;
      if (motivosR.error) throw motivosR.error;

      const leads = (leadsR.data ?? []) as Pick<CrmLeadRow, "estado" | "fuente">[];
      const ops = (opsR.data ?? []) as Array<Pick<CrmOportunidadRow, "motivo_perdida_id"> & { crm_etapas_pipeline: { nombre: string; tipo: string } | null }>;
      const motivos = (motivosR.data ?? []) as { id: string; nombre: string }[];
      const motivoNombre = new Map(motivos.map((m) => [m.id, m.nombre]));

      const embudoMap = new Map<string, number>();
      const motivosMap = new Map<string, number>();
      for (const o of ops) {
        const et = o.crm_etapas_pipeline?.nombre ?? "Sin etapa";
        embudoMap.set(et, (embudoMap.get(et) ?? 0) + 1);
        if (o.crm_etapas_pipeline?.tipo === "perdida" && o.motivo_perdida_id) {
          const nm = motivoNombre.get(o.motivo_perdida_id) ?? "Otro";
          motivosMap.set(nm, (motivosMap.get(nm) ?? 0) + 1);
        }
      }
      const fuenteMap = new Map<string, { total: number; convertidos: number }>();
      for (const l of leads) {
        const f = l.fuente ?? "Otro";
        const c = fuenteMap.get(f) ?? { total: 0, convertidos: 0 };
        c.total += 1;
        if (l.estado === "Convertido") c.convertidos += 1;
        fuenteMap.set(f, c);
      }

      return {
        embudo: Array.from(embudoMap, ([etapa, cantidad]) => ({ etapa, cantidad })),
        porFuente: Array.from(fuenteMap, ([fuente, v]) => ({
          fuente,
          total: v.total,
          convertidos: v.convertidos,
          tasa: v.total ? (v.convertidos / v.total) * 100 : 0,
        })),
        motivosPerdida: Array.from(motivosMap, ([motivo, cantidad]) => ({ motivo, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 5),
      };
    },
  });
}
