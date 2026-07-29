/**
 * Servicio de Estado de Cuenta por cliente.
 *
 * Mismo shape que `fetchCobranza`, pero acepta múltiples `cliente_id`s (para
 * el portal, donde un `client_user` puede estar ligado a varios clientes) y
 * devuelve el detalle desglosado de pagos y notas de crédito por factura,
 * necesario para el modo "fila colapsable con pagos anidados".
 *
 * Reutiliza la misma consulta embebida a `pagos_factura` y `factura_notas_credito`
 * de `services/cobranza.ts` — RLS aplica idénticamente para uso interno y portal.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import type { Tables, Database } from "@/integrations/supabase/types";

type FacturaRow = Tables<"facturas">;
type Moneda = Database["public"]["Enums"]["moneda"];

export type EstatusCobranza = "Vigente" | "Por vencer" | "Vencida" | "Pagada" | "Sin saldo";

export interface PagoDetalle {
  id: string;
  fecha_pago: string;
  monto_aplicado: number;
  monto_no_aplicado: number;
  forma_pago: string | null;
  referencia: string | null;
}

export interface NotaCreditoDetalle {
  id: string;
  folio: string | null;
  fecha_emision: string;
  monto: number;
  estado: string;
}

export interface FacturaEstadoCuenta {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  expediente: string;
  moneda: Moneda;
  total: number;
  pagado: number;
  notas_credito_aplicadas: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_vencido: number;
  estatus_cobranza: EstatusCobranza;
  estado_factura: FacturaRow["estado"];
  pagos: PagoDetalle[];
  notas_credito: NotaCreditoDetalle[];
}

export interface EstadoCuentaFilters {
  clienteIds: string[];
  desde?: string | null;
  hasta?: string | null;
  moneda?: Moneda | "todas";
  soloConSaldo?: boolean;
}

type RawPago = {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  tipo_cambio: number | null;
  monto_aplicado_factura: number;
  forma_pago: string | null;
  referencia: string | null;
  deleted_at: string | null;
};

type RawNota = {
  id: string;
  folio: string | null;
  fecha_emision: string;
  monto: number;
  estado: string;
  deleted_at: string | null;
};

type RawFactura = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_id" | "cliente_nombre" | "expediente"
  | "moneda" | "total" | "fecha_emision" | "fecha_vencimiento" | "estado"
> & {
  pagos_factura: RawPago[] | null;
  factura_notas_credito: RawNota[] | null;
};

function diasVencido(fechaVencimiento: string): number {
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

function calcularEstatus(saldo: number, dias: number, estado: FacturaRow["estado"]): EstatusCobranza {
  if (estado === "Pagada") return "Pagada";
  if (saldo <= 0.01) return "Sin saldo";
  if (dias > 0) return "Vencida";
  // B-105 (decisión de diseño): "Por vencer" = vence en 7 días naturales o
  // menos, alineado con la convención del ERP (tarifas "≤7 días", aging CxC).
  // Antes eran 3 días: una factura a 17 días se veía "Vigente".
  if (dias >= -7) return "Por vencer";
  return "Vigente";
}

const ESTADOS_ACTIVOS = ["Emitida", "Parcialmente pagada", "Vencida", "Pagada"] as const;

// FIX C3 (S6-03): cap explícito verificado; el estado de cuenta alimenta
// KPIs de adeudo hacia el cliente (portal).
const LIMITE_ESTADO_CUENTA = 2000;

export async function fetchEstadoCuenta(filters: EstadoCuentaFilters): Promise<FacturaEstadoCuenta[]> {
  if (!filters.clienteIds.length) return [];

  let query = supabase
    .from("facturas")
    .select(`
      id, numero, cliente_id, cliente_nombre, expediente,
      moneda, total, fecha_emision, fecha_vencimiento, estado,
      pagos_factura(id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago, referencia, deleted_at),
      factura_notas_credito(id, folio, fecha_emision, monto, estado, deleted_at)
    `)
    .in("cliente_id", filters.clienteIds)
    .in("estado", [...ESTADOS_ACTIVOS])
    .order("fecha_emision", { ascending: false })
    .limit(LIMITE_ESTADO_CUENTA);

  if (filters.desde) query = query.gte("fecha_emision", filters.desde);
  if (filters.hasta) query = query.lte("fecha_emision", filters.hasta);
  if (filters.moneda && filters.moneda !== "todas") query = query.eq("moneda", filters.moneda);

  const { data, error } = await query;
  if (error) throw error;
  assertNotTruncated(data, LIMITE_ESTADO_CUENTA, "facturacion.fetchEstadoCuenta");

  // SAFE-CAST: el shape de joins embebidos no lo infiere Supabase.
  const rows = ((data as unknown as RawFactura[] | null) ?? []).map((f): FacturaEstadoCuenta => {
    const pagosActivos = (f.pagos_factura ?? []).filter((p) => !p.deleted_at);
    const notasActivas = (f.factura_notas_credito ?? []).filter(
      (n) => !n.deleted_at && n.estado === "Aplicada",
    );
    const pagado = pagosActivos.reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);
    const nc_aplicadas = notasActivas.reduce((s, n) => s + Number(n.monto), 0);
    const total = Number(f.total);
    const saldo = Math.max(0, total - pagado - nc_aplicadas);
    const dias = diasVencido(f.fecha_vencimiento);

    return {
      id: f.id,
      numero: f.numero,
      cliente_id: f.cliente_id,
      cliente_nombre: f.cliente_nombre,
      expediente: f.expediente,
      moneda: f.moneda,
      total,
      pagado,
      notas_credito_aplicadas: nc_aplicadas,
      saldo,
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: f.fecha_vencimiento,
      dias_vencido: Math.max(0, dias),
      estatus_cobranza: calcularEstatus(saldo, dias, f.estado),
      estado_factura: f.estado,
      pagos: pagosActivos.map((p) => ({
        id: p.id,
        fecha_pago: p.fecha_pago,
        monto_aplicado: Number(p.monto_aplicado_factura),
        // B-077: `monto` está en moneda del PAGO y `monto_aplicado_factura`
        // en moneda de la FACTURA — restarlos directo inventa saldos a favor
        // (factura USD pagada en MXN mostraba "USD 175,000 a favor").
        // Convención (la misma de DialogRegistrarPago): `tipo_cambio`
        // convierte moneda del pago → moneda de la factura; el excedente
        // queda expresado en moneda de la factura. Sin TC confiable → 0.
        monto_no_aplicado: (() => {
          const tc = Number(p.tipo_cambio);
          const factor = p.moneda === f.moneda ? 1 : Number.isFinite(tc) && tc > 0 ? tc : 0;
          return Math.max(0, Number(p.monto) * factor - Number(p.monto_aplicado_factura));
        })(),
        forma_pago: p.forma_pago,
        referencia: p.referencia,
      })),
      notas_credito: notasActivas.map((n) => ({
        id: n.id,
        folio: n.folio,
        fecha_emision: n.fecha_emision,
        monto: Number(n.monto),
        estado: n.estado,
      })),
    };
  });

  return filters.soloConSaldo ? rows.filter((r) => r.saldo > 0.01) : rows;
}
