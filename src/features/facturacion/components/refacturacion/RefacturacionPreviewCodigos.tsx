/**
 * Lista de códigos `LC_REFACT_*` de la vista previa, con dos tonos:
 * `bloqueo` (rojo, impide confirmar) y `pendiente` (ámbar, el trámite ya está
 * en manos del SAT y el usuario puede continuar).
 */
import { AlertTriangle, Clock } from "lucide-react";
import { LC_CODE_MESSAGES_REFACTURACION } from "@/lib/errors/lcCodeMessages.refacturacion";

interface Props {
  codigos: string[];
  tono: "bloqueo" | "pendiente";
}

export function RefacturacionPreviewCodigos({ codigos, tono }: Props) {
  if (codigos.length === 0) return null;
  const esBloqueo = tono === "bloqueo";
  const clases = esBloqueo
    ? "border-destructive/30 bg-destructive/5"
    : "border-warning/30 bg-warning/5";
  const Icono = esBloqueo ? AlertTriangle : Clock;
  const colorIcono = esBloqueo ? "text-destructive" : "text-warning";

  return (
    <ul className="space-y-1">
      {codigos.map((codigo) => (
        <li
          key={codigo}
          className={`flex items-start gap-2 rounded-md border p-2 text-xs ${clases}`}
        >
          <Icono className={`mt-0.5 h-3.5 w-3.5 ${colorIcono}`} aria-hidden="true" />
          <span>{LC_CODE_MESSAGES_REFACTURACION[codigo] ?? codigo}</span>
        </li>
      ))}
    </ul>
  );
}
