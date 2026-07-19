/**
 * Hint bajo el input de Tipo de cambio, indicando el origen del valor.
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { formatFechaEs } from "@/features/cxp/hooks/useTcDofPorFecha";
import type { TcOrigen } from "./FacturaProveedorFormFields";

export function TcOrigenHint({ origen, fechaAplicada }: { origen: TcOrigen; fechaAplicada?: string }) {
  if (origen === "vacio") return null;
  const fecha = formatFechaEs(fechaAplicada);
  const text =
    origen === "dof"
      ? `DOF ${fecha || "—"} · Banxico SF43718`
      : origen === "cfdi"
        ? "Del CFDI del proveedor"
        : "Capturado manualmente";
  return <p className="text-label text-muted-foreground">{text}</p>;
}
