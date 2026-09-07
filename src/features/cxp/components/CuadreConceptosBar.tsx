/**
 * Barra de cuadre conceptos ↔ subtotal para captura de facturas de proveedor.
 *
 * Feedback visual en vivo que replica la regla del trigger BD
 * `_cxp_validar_aprobacion`. No bloquea el guardado (el usuario puede
 * dejar la factura como borrador), pero avisa exactamente cuánto falta o
 * sobra para que la factura sea aprobable.
 *
 * v13.399.0 — Se explica de dónde sale la suma (fórmula + renglones) y el
 * consejo del estado "sobrante" apunta primero al error real de captura
 * (importe unitario capturado como total de línea / mezcla de moneda).
 *
 * R170-10 — El aviso "no desglosado por partida" sólo aparece cuando de verdad
 * las partidas no traen IVA. Si el CFDI ya lo desglosa por renglón, se dice
 * eso; y si el IVA de las partidas no coincide con el de la cabecera, se
 * muestran ambos números en vez de afirmar algo falso.
 */
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/formatters";
import type { EstadoCuadre, ResultadoCuadre } from "@/features/cxp/utils/cuadreConceptos";


interface Props {
  resultado: ResultadoCuadre;
  subtotal: number;
  moneda: string;
  /** Número de renglones considerados en la suma. */
  renglones?: number;
  /** IVA global del documento (cabecera), cuando no viene desglosado por partida. */
  ivaGlobal?: number;
  /** Total del documento (subtotal + impuestos), para contrastar con "Conceptos". */
  totalDocumento?: number;
  /** R170-10: IVA sumado de las partidas (0 cuando ninguna lo desglosa). */
  ivaPartidas?: number;
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
    ayuda:
      "Revisa los renglones con cantidad mayor a 1: el campo Importe es unitario y se multiplica por la cantidad. "
      + `Confirma también que el subtotal esté en ${moneda}. Si de verdad es un descuento del proveedor, agrega un renglón con importe negativo.`,
  };
}

/**
 * R170-10 · Explicación honesta del IVA según lo que traen las partidas.
 */
function explicacionIva(ivaGlobal: number, ivaPartidas: number, moneda: string): string {
  if (ivaPartidas <= 0) {
    return `incluye ${formatCurrency(ivaGlobal, moneda)} de IVA capturado a nivel documento (no desglosado por partida).`;
  }
  if (Math.abs(ivaPartidas - ivaGlobal) <= 0.01) {
    return `incluye ${formatCurrency(ivaGlobal, moneda)} de IVA, ya desglosado en las partidas.`;
  }
  return (
    `incluye ${formatCurrency(ivaGlobal, moneda)} de IVA en la cabecera, mientras que las partidas desglosan `
    + `${formatCurrency(ivaPartidas, moneda)}: revisa la diferencia antes de aprobar.`
  );
}

export function CuadreConceptosBar({ resultado, subtotal, moneda, renglones, ivaGlobal, totalDocumento, ivaPartidas }: Props) {
  const v = visualPorEstado(resultado.estado, resultado.diferencia, moneda);
  const abs = Math.abs(resultado.diferencia);
  const signo = resultado.diferencia > 0 ? "faltan" : "sobran";
  const [abierto, setAbierto] = useState(false);


  return (
    <div className={`rounded-md border ${v.border} ${v.bg} px-3 py-2 text-body-sm`} aria-live="polite">
      <div className={`flex flex-wrap items-center gap-2 font-medium ${v.text}`}>
        {v.icon}
        <span>{v.titulo}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3 tabular-nums text-foreground">
          <span className="text-muted-foreground">
            Subtotal: <span className="font-semibold text-foreground">{formatCurrency(subtotal, moneda)}</span>
          </span>
          <span className="text-muted-foreground">
            Conceptos: <span className="font-semibold text-foreground">{formatCurrency(resultado.suma, moneda)}</span>
            {typeof renglones === "number" && (
              <span className="ml-1">({renglones} renglón{renglones === 1 ? "" : "es"})</span>
            )}
          </span>
        </div>
      </div>
      {resultado.estado === "cuadrado" && (ivaGlobal ?? 0) > 0 && (
        <p className="text-muted-foreground mt-1 pl-6 text-label">
          {`Total de partidas: ${formatCurrency(subtotal, moneda)} (sin impuestos). `}
          {`Total del documento: ${formatCurrency(totalDocumento ?? subtotal + (ivaGlobal ?? 0), moneda)}, `}
          {explicacionIva(ivaGlobal ?? 0, ivaPartidas ?? 0, moneda)}
        </p>
      )}
      {resultado.estado !== "cuadrado" && resultado.estado !== "sin_conceptos" && (
        <Collapsible open={abierto} onOpenChange={setAbierto}>
          <CollapsibleTrigger className="mt-1 ml-6 flex items-center gap-1 text-label font-medium text-muted-foreground underline-offset-2 hover:underline">
            ¿Por qué no cuadra?
            <ChevronDown className={`h-3 w-3 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6">
            <p className="text-muted-foreground mt-1 tabular-nums">
              {formatCurrency(subtotal, moneda)} − {formatCurrency(resultado.suma, moneda)} ={" "}
              <span className="font-medium text-foreground">
                {`${formatCurrency(abs, moneda)} (${signo})`}
              </span>
              {" · la suma multiplica cada importe unitario por su cantidad, sin IVA"}
            </p>
            <p className="text-muted-foreground mt-1">{v.ayuda}</p>
          </CollapsibleContent>
        </Collapsible>
      )}
      {/* v13.423.0 — Sin conceptos la ayuda se esconde en pantallas bajas:
          el renglón único deja aire para el formulario. */}
      {resultado.estado === "sin_conceptos" && (
        <p className="text-muted-foreground mt-1 pl-6 short:hidden">{v.ayuda}</p>
      )}

    </div>
  );
}


