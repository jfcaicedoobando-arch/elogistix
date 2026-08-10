/**
 * Aviso inline dentro del modal de proforma cuando el embarque no tiene
 * tipo de cambio USD capturado: permite capturarlo y reintentar la
 * generación sin cerrar el modal.
 *
 * v13.409.0
 */
import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  /** Último TC DOF conocido, usado como valor sugerido. */
  tcSugerido: number | null;
  guardando: boolean;
  onGuardarYReintentar: (tc: number) => void;
}

export function AvisoTcRequerido({ tcSugerido, guardando, onGuardarYReintentar }: Props) {
  const [valor, setValor] = useState("");

  // Ola 9 · B5: parseo centralizado (maneja "$ 1,200.50" y espacios duros).
  const tc = parseMonto(valor, NaN);

  const valido = Number.isFinite(tc) && tc > 0;

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Falta el tipo de cambio USD del embarque</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          Hay conceptos en dólares y el embarque no tiene tipo de cambio capturado.
          Captúralo aquí y volvemos a generar la proforma automáticamente.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="tc-usd-proforma" className="text-xs">
              Tipo de cambio USD → MXN
            </Label>
            <Input
              id="tc-usd-proforma"
              inputMode="decimal"
              className="w-40 [appearance:textfield]"
              placeholder={tcSugerido ? tcSugerido.toFixed(4) : "18.5000"}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={guardando}
            />
          </div>
          {tcSugerido != null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={guardando}
              onClick={() => setValor(tcSugerido.toFixed(4))}
            >
              Usar DOF {tcSugerido.toFixed(4)}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!valido || guardando}
            onClick={() => onGuardarYReintentar(tc)}
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> Guardar y reintentar
              </>
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
