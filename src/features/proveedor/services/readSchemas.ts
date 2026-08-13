/**
 * Schemas zod de los boundaries de dinero del estado de cuenta del proveedor.
 *
 * Las RPCs `proveedor_estado_cuenta` y `proveedor_estado_cuenta_movimientos`
 * devuelven `jsonb`, así que TypeScript no puede garantizar el shape. Aquí se
 * valida en runtime lo crítico (identidad, moneda y montos) para que un cambio
 * de columna o un monto `null` falle con un `ZodError` que trae el path exacto,
 * en vez de propagar `undefined` a los totales de la pantalla.
 */
import { z } from "zod";

/** Monto que puede llegar como number o como string numérico (numeric de PG). */
const monto = z.coerce.number().finite();
const montoNullable = z.coerce.number().finite().nullable();

const facturaVinculadaSchema = z.object({
  factura_id: z.string(),
  folio_interno: z.string().nullable(),
  folio_proveedor: z.string().nullable(),
  estado: z.string().nullable(),
  estado_aprobacion: z.string().nullable(),
  fecha_emision: z.string().nullable(),
  fecha_vencimiento: z.string().nullable(),
  moneda: z.string().nullable(),
  total: montoNullable,
});

const partidaSchema = z.object({
  concepto_costo_id: z.string(),
  embarque_id: z.string().nullable(),
  expediente: z.string(),
  cliente_nombre: z.string(),
  concepto: z.string(),
  comprometido: monto,
  moneda: z.string(),
  estado_liquidacion: z.string(),
  fecha_vencimiento: z.string().nullable(),
  created_at: z.string(),
  facturado: monto,
  pagado: monto,
  por_facturar: monto,
  facturas: z.array(facturaVinculadaSchema),
  estado_conciliacion: z.enum([
    "Por facturar",
    "Facturado parcial",
    "Facturado",
    "Pagado",
    "Sobrefacturado",
  ]),
});

const facturaHuerfanaSchema = z.object({
  factura_id: z.string(),
  folio_interno: z.string().nullable(),
  folio_proveedor: z.string().nullable(),
  fecha_emision: z.string().nullable(),
  moneda: z.string(),
  monto_sin_vincular: monto,
  partidas: z.coerce.number().int(),
});

/** Payload completo de `proveedor_estado_cuenta` (tolera `null` de la RPC). */
export const estadoCuentaProveedorSchema = z
  .object({
    partidas: z.array(partidaSchema).nullish(),
    facturas_huerfanas: z.array(facturaHuerfanaSchema).nullish(),
  })
  .nullable();

const movimientoSchema = z.object({
  fecha: z.string(),
  tipo: z.enum(["Factura", "Nota de crédito", "Pago", "Anticipo aplicado", "Anticipo"]),
  ref_id: z.string(),
  folio: z.string(),
  referencia: z.string().nullable(),
  expediente: z.string(),
  embarque_id: z.string().nullable(),
  moneda: z.string(),
  cargo: monto,
  abono: monto,
  detalle: z.string().nullable(),
});

const agingFilaSchema = z.object({
  moneda: z.string(),
  bucket: z.enum(["Vigente", "1-30", "31-60", "61-90", "90+"]),
  saldo: monto,
  conteo: z.coerce.number().int(),
});

const saldoMonedaSchema = z.object({
  moneda: z.string(),
  cargos: monto,
  abonos: monto,
  saldo: monto,
});

/** Payload completo de `proveedor_estado_cuenta_movimientos`. */
export const estadoCuentaMovimientosSchema = z
  .object({
    movimientos: z.array(movimientoSchema).nullish(),
    aging: z.array(agingFilaSchema).nullish(),
    saldos: z.array(saldoMonedaSchema).nullish(),
  })
  .nullable();
