/**
 * Tipos compartidos de pagos a proveedor (CxP). Módulo sin dependencias
 * de red para que otros módulos (bitácora, validaciones) no importen el
 * service completo.
 */
import type { Tables } from "@/integrations/supabase/types";

export type PagoProveedor = Tables<"pagos_proveedor">;

export type PagoProveedorConMov = PagoProveedor & {
  bbva_movimientos: Array<{
    id: string;
    fecha: string;
    concepto: string | null;
    referencia: string | null;
    cargo: number | string;
    abono: number | string;
    estado_conciliacion: "Pendiente" | "Conciliado" | "Ignorado";
  }> | null;
};

export interface RegistrarPagoProveedorInput {
  proveedor_factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoProveedor["moneda"];
  /** TC MXN por 1 USD. `null` cuando el pago y la factura son MXN (no aplica). Debe ser > 0 si se envía (check `pagos_proveedor_tc_pos`). */
  tipo_cambio_usd: number | null;
  metodo_pago: string;
  referencia?: string;
  cuenta_bancaria_id?: string | null;
  notas?: string;
  /** Si la factura es USD y se paga en MXN, esta es la diferencia respecto al TC original. */
  diferencia_cambiaria_mxn?: number | null;
}
