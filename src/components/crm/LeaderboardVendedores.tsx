/**
 * Leaderboard de vendedores (Sprint D).
 * Muestra cuota vs. cerrado del mes en curso por vendedor.
 */
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyCompact } from "@/lib/formatters";

interface Fila {
  vendedor: string;
  cuota: number;
  cerrado: number;
  avance: number;
}

async function fetchLeaderboard(): Promise<Fila[]> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().slice(0, 10);

  const [cuotasR, opsR, etapasR] = await Promise.all([
    supabase
      .from("crm_cuotas_vendedor")
      .select("vendedor_email, cuota_monto, anio, mes")
      .eq("anio", ahora.getFullYear())
      .eq("mes", ahora.getMonth() + 1),
    supabase
      .from("crm_oportunidades")
      .select("vendedor_email, valor_real, monto_estimado, etapa_id, fecha_cierre_real")
      .gte("fecha_cierre_real", inicioMes),
    supabase.from("crm_etapas_pipeline").select("id, tipo"),
  ]);
  if (cuotasR.error) throw cuotasR.error;
  if (opsR.error) throw opsR.error;
  if (etapasR.error) throw etapasR.error;

  const tipoEtapa = new Map((etapasR.data ?? []).map((e) => [e.id, e.tipo]));
  const cerradoMap = new Map<string, number>();
  for (const o of opsR.data ?? []) {
    if (tipoEtapa.get(o.etapa_id) !== "ganada") continue;
    const k = o.vendedor_email || "Sin asignar";
    const monto = Number(o.valor_real ?? o.monto_estimado ?? 0);
    cerradoMap.set(k, (cerradoMap.get(k) ?? 0) + monto);
  }
  const cuotaMap = new Map<string, number>();
  for (const c of cuotasR.data ?? []) {
    cuotaMap.set(c.vendedor_email || "Sin asignar", Number(c.cuota_monto ?? 0));
  }
  const todos = new Set<string>([...cerradoMap.keys(), ...cuotaMap.keys()]);
  const filas: Fila[] = Array.from(todos).map((vendedor) => {
    const cuota = cuotaMap.get(vendedor) ?? 0;
    const cerrado = cerradoMap.get(vendedor) ?? 0;
    const avance = cuota > 0 ? Math.min(100, Math.round((cerrado / cuota) * 100)) : 0;
    return { vendedor, cuota, cerrado, avance };
  });
  return filas.sort((a, b) => b.cerrado - a.cerrado);
}

export default function LeaderboardVendedores() {
  const { data = [], isLoading } = useQuery<Fila[]>({
    queryKey: ["crm", "leaderboard-vendedores"],
    queryFn: fetchLeaderboard,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Leaderboard del mes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad de cierre este mes.</p>
        ) : (
          <ul className="space-y-3">
            {data.map((f) => (
              <li key={f.vendedor} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate max-w-[60%]">{f.vendedor}</span>
                  <span className="text-muted-foreground">
                    {formatCurrencyCompact(f.cerrado, "MXN")}
                    {f.cuota > 0 && <> / {formatCurrencyCompact(f.cuota, "MXN")}</>}
                  </span>
                </div>
                <Progress value={f.avance} className="h-2" />
                <div className="text-xs text-muted-foreground text-right">{f.avance}%</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
