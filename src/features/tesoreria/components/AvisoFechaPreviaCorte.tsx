/**
 * Aviso inline: la fecha capturada es anterior al corte del saldo inicial de la
 * cuenta, así que el movimiento no afectará el saldo actual (v13.451.0).
 */
import { Info } from "lucide-react";
import { avisoFechaPreviaCorte } from "@/features/tesoreria/domain/corteSaldo";

interface Props {
  fecha: string | null | undefined;
  /** `cuentas_bancarias.fecha_saldo_inicial` de la cuenta elegida. */
  corte: string | null | undefined;
  aliasCuenta?: string | null;
}

export function AvisoFechaPreviaCorte({ fecha, corte, aliasCuenta }: Props) {
  const texto = avisoFechaPreviaCorte({ fecha, corte, aliasCuenta });
  if (!texto) return null;
  return (
    <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
      <Info className="h-4 w-4 shrink-0 text-warning mt-0.5" aria-hidden />
      <p className="text-xs text-warning">{texto}</p>
    </div>
  );
}
