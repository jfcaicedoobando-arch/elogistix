/**
 * Corrección de la moneda leída por IA, en el paso 1 del asistente de captura.
 *
 * Muchas notas de débito de navieras imprimen los cargos en USD y el total
 * equivalente en pesos; la IA puede quedarse con la moneda equivocada. Este
 * bloque expone el MISMO campo `moneda` del paso 2 (no duplica estado) junto a
 * la lectura de la IA, con su tipo de cambio y el botón "Obtener DOF".
 *
 * Sólo se muestra para documentos leídos por IA: el desglose de un XML CFDI es
 * fiscal y su moneda no se corrige aquí.
 */
import { Coins, RefreshCw, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NumericInput } from "@/components/shared/NumericInput";
import type { Moneda } from "@/types/db";
import type { TcOrigen } from "@/features/cxp/types";
import { TcOrigenHint } from "./FacturaProveedorFormFields.hint";

const toNum = (s: string) => (s === "" ? 0 : Number(s) || 0);
const fromNum = (n: number) => (n === 0 ? "" : String(n));

interface Props {
  moneda: Moneda;
  tc: string;
  tcOrigen: TcOrigen;
  tcFechaAplicada?: string;
  onMoneda: (m: Moneda) => void;
  onTc: (v: string) => void;
  onObtenerDof?: () => void;
  dofLoading?: boolean;
}

export function MonedaDetectadaIaCard({
  moneda, tc, tcOrigen, tcFechaAplicada, onMoneda, onTc, onObtenerDof, dofLoading = false,
}: Props) {
  const showTc = moneda !== "MXN";

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-body font-medium">
          <Coins className="size-4 text-primary" />
          Moneda detectada por la IA
        </div>
        {showTc && onObtenerDof && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-label"
            onClick={onObtenerDof}
            loading={dofLoading}
          >
            <RefreshCw className="size-3 mr-1" />
            Obtener DOF
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1 w-36 shrink-0">
          <Label htmlFor="moneda-ia">Moneda de la factura</Label>
          <Select value={moneda} onValueChange={(v) => onMoneda(v as Moneda)}>
            <SelectTrigger id="moneda-ia" aria-label="Moneda de la factura detectada por la IA">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showTc && (
          <div className="space-y-1 flex-1 min-w-48">
            <Label htmlFor="tc-ia">Tipo de cambio a MXN</Label>
            <NumericInput
              id="tc-ia"
              value={toNum(tc)}
              onChange={(n) => onTc(fromNum(n))}
              decimals
              aria-label="Tipo de cambio a MXN"
            />
            <TcOrigenHint origen={tcOrigen} fechaAplicada={tcFechaAplicada} />
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
        <AlertTriangle className="size-4 flex-shrink-0 mt-0.5 text-warning" />
        <span>
          Revisa la moneda: en documentos que muestran el cargo en dólares y el equivalente
          en pesos la IA puede equivocarse. Al cambiarla,{" "}
          <strong>los importes no se convierten solos</strong> — verifica que subtotal, IVA y
          conceptos correspondan a la moneda elegida.
        </span>
      </p>
    </div>
  );
}
