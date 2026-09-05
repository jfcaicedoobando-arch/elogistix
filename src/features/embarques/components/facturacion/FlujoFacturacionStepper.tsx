/**
 * Stepper visual del flujo de facturación de un embarque:
 * Conceptos → Proformas → Facturas. Sólo presentacional.
 */
import { Check, FileSpreadsheet, Receipt, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  conceptosCount: number;
  facturadosCount: number;
  proformasCount: number;
  /** Proformas convertidas (estado comercial 'facturada'), emitidas o no. */
  proformasConvertidasCount: number;
  /** B9: proformas cuya factura ya salió de preparación (emitida de verdad). */
  proformasEmitidasCount: number;
  facturasCount: number;
  /** B9: sólo las que salieron de Borrador/Por timbrar (factura ya emitida). */
  facturasEmitidasCount: number;
}

type Estado = "vacio" | "activo" | "completo";

function estadoConceptos(total: number, facturados: number): Estado {
  if (total === 0) return "vacio";
  if (facturados === total) return "completo";
  return "activo";
}

function estadoProformas(total: number, facturadas: number): Estado {
  if (total === 0) return "vacio";
  if (facturadas === total) return "completo";
  return "activo";
}

function estadoFacturas(total: number, emitidas: number): Estado {
  if (total === 0) return "vacio";
  return emitidas > 0 ? "completo" : "activo";
}

/** B9: no llamar "emitida" a una factura que sigue en Borrador. */
function detalleFacturas(total: number, emitidas: number): string {
  if (total === 0) return "Sin facturas";
  const borradores = total - emitidas;
  if (emitidas === 0) return `${borradores} en borrador`;
  const base = `${emitidas} emitida${emitidas === 1 ? "" : "s"}`;
  return borradores > 0 ? `${base} · ${borradores} en borrador` : base;
}

interface PasoProps {
  numero: number;
  titulo: string;
  detalle: string;
  estado: Estado;
  icon: React.ComponentType<{ className?: string }>;
}

function Paso({ numero, titulo, detalle, estado, icon: Icon }: PasoProps) {
  const styles = {
    vacio: {
      circle: "bg-muted text-muted-foreground border-border",
      title: "text-muted-foreground",
      detail: "text-muted-foreground/70",
    },
    activo: {
      circle: "bg-info/15 [color:hsl(var(--info))] border-info/40",
      title: "text-foreground",
      detail: "[color:hsl(var(--info))]",
    },
    completo: {
      circle: "bg-success/15 text-success border-success/40",
      title: "text-foreground",
      detail: "text-success",
    },
  }[estado];

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className={cn(
        "shrink-0 w-9 h-9 rounded-full border flex items-center justify-center",
        styles.circle,
      )}>
        {estado === "completo" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
          <span className="font-mono">{numero}.</span>
          <span className={cn("font-semibold", styles.title)}>{titulo}</span>
        </div>
        <div className={cn("text-body-sm truncate", styles.detail)}>{detalle}</div>
      </div>
    </div>
  );
}

function Conector({ activo }: { activo: boolean }) {
  return (
    <div className={cn(
      "hidden md:block h-px flex-1 mx-2",
      activo ? "bg-success/40" : "bg-border",
    )} />
  );
}

export function FlujoFacturacionStepper({
  conceptosCount, facturadosCount,
  proformasCount, proformasFacturadasCount,
  facturasCount, facturasEmitidasCount,
}: Props) {
  const e1 = estadoConceptos(conceptosCount, facturadosCount);
  const e2 = estadoProformas(proformasCount, proformasFacturadasCount);
  const e3 = estadoFacturas(facturasCount, facturasEmitidasCount);

  const det1 = conceptosCount === 0
    ? "Sin conceptos"
    : facturadosCount === conceptosCount
      ? `${conceptosCount} facturado${conceptosCount === 1 ? "" : "s"}`
      : `${facturadosCount} / ${conceptosCount} facturados`;

  const det2 = proformasCount === 0
    ? "Sin proformas"
    : proformasFacturadasCount === proformasCount
      ? `${proformasCount} facturada${proformasCount === 1 ? "" : "s"}`
      : `${proformasCount} generada${proformasCount === 1 ? "" : "s"} · ${proformasFacturadasCount} facturada${proformasFacturadasCount === 1 ? "" : "s"}`;

  const det3 = detalleFacturas(facturasCount, facturasEmitidasCount);

  return (
    <div className="flex items-center gap-2 md:gap-0 rounded-lg border bg-card px-4 py-3">
      <Paso numero={1} titulo="Conceptos"  detalle={det1} estado={e1} icon={ScrollText} />
      <Conector activo={e1 === "completo"} />
      <Paso numero={2} titulo="Proformas"  detalle={det2} estado={e2} icon={FileSpreadsheet} />
      <Conector activo={e2 === "completo"} />
      <Paso numero={3} titulo="Facturas"   detalle={det3} estado={e3} icon={Receipt} />
    </div>
  );
}
