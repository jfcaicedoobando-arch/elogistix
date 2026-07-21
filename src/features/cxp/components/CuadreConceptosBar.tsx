/**
 * Barra de cuadre conceptos ↔ subtotal para captura de facturas de proveedor.
 *
 * Feedback visual en vivo que replica la regla del trigger BD
 * `_cxp_validar_aprobacion`. No bloquea el guardado (el usuario puede
 * dejar la factura como borrador), pero avisa exactamente cuánto falta o
 * sobra para que la factura sea aprobable.
 */
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { EstadoCuadre, ResultadoCuadre } from "@/features/cxp/utils/cuadreConceptos";

interface Props {
  resultado: ResultadoCuadre;
  subtotal: number;
  moneda: string;
}

interface EstadoVisual {
  border: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
  titulo: string;
  ayuda: string;
}

function visualPorEstado(estado: EstadoCuadre, diferencia: number, moneda: string): EstadoVisual {
  if (estado === "cuadrado") {
    return {
      border: "border-success/40",
      bg: "bg-success/5",
      text: "text-success",
      icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
      titulo: "Conceptos cuadrados con el subtotal",
      ayuda: "La factura está lista para aprobarse.",
    };
  }
  if (estado === "sin_conceptos") {
    return {
      border: "border-muted",
      bg: "bg-muted/30",
      text: "text-muted-foreground",
      icon: <Info className="h-4 w-4 shrink-0" />,
      titulo: "Aún no hay conceptos capturados",
      ayuda: "Sube el XML o vincula conceptos de embarque para cuadrar con el subtotal.",
    };
  }
  const abs = Math.abs(diferencia);
  if (estado === "faltante") {
    return {
      border: "border-warning/40",
      bg: "bg-warning/5",
      text: "text-warning",
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      titulo: `Faltan ${formatCurrency(abs, moneda)} por capturar`,
      ayuda: "Agrega otro concepto (o aumenta un monto) para cubrir el subtotal.",
    };
  }
  return {
    border: "border-destructive/40",
    bg: "bg-destructive/5",
    text: "text-destructive",
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    titulo: `Sobran ${formatCurrency(abs, moneda)} sobre el subtotal`,
    ayuda: "¿Descuento del proveedor? Agrega un renglón con importe negativo por la diferencia.",
  };
}

export function CuadreConceptosBar({ resultado, subtotal, moneda }: Props) {
  const v = visualPorEstado(resultado.estado, resultado.diferencia, moneda);

  return (
    <div className={`rounded-md border ${v.border} ${v.bg} px-3 py-2 text-xs`}>
      <div className={`flex items-center gap-2 font-medium ${v.text}`}>
        {v.icon}
        <span>{v.titulo}</span>
        <div className="ml-auto flex items-center gap-3 tabular-nums text-foreground">
          <span className="text-muted-foreground">
            Subtotal: <span className="font-semibold text-foreground">{formatCurrency(subtotal, moneda)}</span>
          </span>
          <span className="text-muted-foreground">
            Conceptos: <span className="font-semibold text-foreground">{formatCurrency(resultado.suma, moneda)}</span>
          </span>
        </div>
      </div>
      <p className="text-muted-foreground mt-1 pl-6">{v.ayuda}</p>
    </div>
  );
}
