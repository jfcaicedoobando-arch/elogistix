/**
 * N10 — Aviso explícito de listado incompleto: la consulta de cartera devuelve
 * como máximo 500 facturas y los totales de la pantalla se calculan sobre ese
 * corte. Sin este aviso el subconjunto se leía como la cartera completa.
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  totalEnBase: number;
  mostradas: number;
}

export function CarteraTruncadoAlert({ totalEnBase, mostradas }: Props) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertDescription>
        Vista incompleta: hay {totalEnBase} facturas con saldo y aquí se muestran las {mostradas}{" "}
        más próximas a vencer. Los totales de abajo NO son la cartera completa; filtra por moneda
        o urgencia para revisar el resto.
      </AlertDescription>
    </Alert>
  );
}
