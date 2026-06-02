// CxC recordatorios (Sprint 1 — stub).
//
// Devuelve facturas por organización con saldo > 0 segmentadas por ventana
// de cobranza (-3d antes del vencimiento, +7d y +15d después). El envío real
// (correo / WhatsApp) se implementará en un sprint posterior cuando se
// integre Resend / WhatsApp Business.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body { organization_id?: string }

interface FacturaRow {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  total: number;
  moneda: string;
  fecha_vencimiento: string;
  pagos_factura: Array<{ monto_aplicado_factura: number; deleted_at: string | null }> | null;
  factura_notas_credito: Array<{ monto: number; estado: string; deleted_at: string | null }> | null;
}

function ventana(diasParaVencer: number): "T-3" | "T+7" | "T+15" | null {
  if (diasParaVencer === -3) return "T-3";
  if (diasParaVencer === 7) return "T+7";
  if (diasParaVencer === 15) return "T+15";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, key);

    let query = supabase
      .from("facturas")
      .select(`
        id, numero, cliente_id, cliente_nombre, total, moneda, fecha_vencimiento,
        pagos_factura(monto_aplicado_factura, deleted_at),
        factura_notas_credito(monto, estado, deleted_at)
      `)
      .in("estado", ["Emitida", "Parcialmente pagada", "Vencida"])
      .is("deleted_at", null)
      .limit(5000);

    if (body.organization_id) query = query.eq("organization_id", body.organization_id);

    const { data, error } = await query;
    if (error) throw error;

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    const buckets: Record<string, Array<Record<string, unknown>>> = { "T-3": [], "T+7": [], "T+15": [] };

    for (const f of (data ?? []) as FacturaRow[]) {
      const pagado = (f.pagos_factura ?? [])
        .filter((p) => !p.deleted_at)
        .reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);
      const nc = (f.factura_notas_credito ?? [])
        .filter((n) => !n.deleted_at && n.estado === "Aplicada")
        .reduce((s, n) => s + Number(n.monto), 0);
      const saldo = Math.max(0, Number(f.total) - pagado - nc);
      if (saldo <= 0.01) continue;

      const venc = new Date(f.fecha_vencimiento + "T00:00:00Z");
      const dias = Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      const v = ventana(dias);
      if (!v) continue;
      buckets[v].push({
        factura_id: f.id, numero: f.numero,
        cliente_id: f.cliente_id, cliente_nombre: f.cliente_nombre,
        saldo, moneda: f.moneda, fecha_vencimiento: f.fecha_vencimiento, dias,
      });
    }

    return new Response(JSON.stringify({ ok: true, generado_en: new Date().toISOString(), buckets }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
