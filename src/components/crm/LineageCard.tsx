/**
 * Tarjetas de linaje del CRM:
 *  - LeadLineageCard:        Lead → Oportunidades generadas
 *  - OportunidadLineageCard: Oportunidad → Lead origen + Cotizaciones + Embarques
 * Sin nuevas tablas; usa queries directas a Supabase.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, Ship, Target, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyCompact } from "@/lib/formatters";

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

interface OpRow {
  id: string;
  nombre: string;
  monto_estimado: number | null;
  moneda: string;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
}

export function LeadLineageCard({ leadId }: { leadId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["crm", "lineage", "lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .select("id, nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpRow[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Oportunidades generadas
          <Badge variant="outline" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {!isLoading && data.length === 0 && <Empty text="Este lead aún no tiene oportunidades." />}
        {data.map((o) => (
          <Link
            key={o.id}
            to={`/crm/oportunidades/${o.id}`}
            className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{o.nombre}</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrencyCompact(Number(o.monto_estimado ?? 0), o.moneda)} ·{" "}
                {Number(o.probabilidad ?? 0)}% · cierre {o.fecha_estimada_cierre ?? "—"}
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

interface CotRow {
  id: string;
  folio: string;
  estado: string;
  modo: string;
  embarque_id: string | null;
  created_at: string;
}
interface EmbRow {
  id: string;
  expediente: string;
  estado: string;
  modo: string;
}

interface OpLineageProps {
  oportunidadId: string;
  leadId: string | null;
}

export function OportunidadLineageCard({ oportunidadId, leadId }: OpLineageProps) {
  const cotsQ = useQuery({
    queryKey: ["crm", "lineage", "op", oportunidadId, "cots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("id, folio, estado, modo, embarque_id, created_at")
        .eq("oportunidad_id", oportunidadId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CotRow[];
    },
  });

  const embarqueIds = (cotsQ.data ?? []).map((c) => c.embarque_id).filter((x): x is string => !!x);
  const embsQ = useQuery({
    queryKey: ["crm", "lineage", "op", oportunidadId, "embs", embarqueIds.sort().join(",")],
    enabled: embarqueIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embarques")
        .select("id, expediente, estado, modo")
        .in("id", embarqueIds)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as EmbRow[];
    },
  });

  const leadQ = useQuery({
    queryKey: ["crm", "lineage", "op", oportunidadId, "lead", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("id, empresa, estado")
        .eq("id", leadId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cots = cotsQ.data ?? [];
  const embs = embsQ.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" /> Origen y conversiones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <UserPlus className="h-3 w-3" /> Lead de origen
          </div>
          {leadId && leadQ.data ? (
            <Link to={`/crm/leads/${leadId}`} className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50">
              <div className="text-sm font-medium truncate">{leadQ.data.empresa}</div>
              <Badge variant="outline">{leadQ.data.estado}</Badge>
            </Link>
          ) : (
            <Empty text="Oportunidad creada directamente (sin lead)." />
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Cotizaciones <Badge variant="outline" className="ml-1">{cots.length}</Badge>
          </div>
          {cotsQ.isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
          {!cotsQ.isLoading && cots.length === 0 && <Empty text="Aún no hay cotizaciones vinculadas." />}
          <div className="space-y-1">
            {cots.map((c) => (
              <Link key={c.id} to={`/cotizaciones/${c.id}/editar`} className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50">
                <div className="text-sm font-medium truncate">{c.folio}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{c.modo}</Badge>
                  <Badge variant="secondary" className="text-xs">{c.estado}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Ship className="h-3 w-3" /> Embarques <Badge variant="outline" className="ml-1">{embs.length}</Badge>
          </div>
          {embarqueIds.length === 0 && <Empty text="Sin embarques generados todavía." />}
          <div className="space-y-1">
            {embs.map((e) => (
              <Link key={e.id} to={`/embarques/${e.id}`} className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50">
                <div className="text-sm font-medium truncate">{e.expediente}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{e.modo}</Badge>
                  <Badge variant="secondary" className="text-xs">{e.estado}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
