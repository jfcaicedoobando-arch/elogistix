/**
 * Props de `PagoProveedorFormBody`, extraídas para mantener el componente
 * bajo el límite de 200 líneas (Power of 10).
 */
import type { FacturaCxP } from "@/features/cxp/services";
import type { Database } from "@/integrations/supabase/types";
import type { CuentaBancaria } from "@/features/tesoreria";
import type { ImpactoPago } from "@/features/cxp/services/pagoImpactoPreview";

export type Moneda = Database["public"]["Enums"]["moneda"];

export interface PagoProveedorFormBodyProps {
  factura: FacturaCxP | null;
  fecha: string;
  setFecha: (v: string) => void;
  metodo: string;
  setMetodo: (v: string) => void;
  metodosDisponibles: readonly string[];
  monto: string;
  setMonto: (v: string) => void;
  moneda: Moneda;
  setMoneda: (v: Moneda) => void;
  tc: string;
  setTc: (v: string) => void;
  showTc: boolean;
  saldoRestante: number;
  excede: boolean;
  esUsdPagadoEnMxn: boolean;
  diffMxn: string;
  setDiffMxn: (v: string) => void;
  referencia: string;
  setReferencia: (v: string) => void;
  notas: string;
  setNotas: (v: string) => void;
  montoEnMonedaFactura: number;
  bloqueadoPorTc: boolean;
  /** R6-N1: cuenta bancaria de donde sale el pago. */
  cuentas: CuentaBancaria[];
  cuentaId: string;
  setCuentaId: (v: string) => void;
  requiereCuenta: boolean;
  /** Incoherencias de IVA/totales de la factura (informativas). */
  validacion: { error: string | null; avisos: string[] };
  /** Vista previa del impacto del pago (factura, proveedor y banco). */
  impacto: ImpactoPago | null;
  cargandoSaldoProveedor?: boolean;
}
