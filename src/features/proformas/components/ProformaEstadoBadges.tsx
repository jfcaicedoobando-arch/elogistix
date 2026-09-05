/**
 * Badges de estado del ciclo de la proforma y del origen de aceptación.
 * Extraído de `ProformaDetalleCards` para respetar Power-of-10 #4 (≤200 líneas).
 */
import { Globe, UserCheck, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  etiquetaProformaConvertida,
  type FacturaCicloLite,
} from "@/lib/domain/etiquetaCicloProforma";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type EstadoCliente = "pendiente" | "aceptada" | "rechazada";
export type OrigenAceptacion = "portal" | "manual" | "migracion" | "desconocido";

/**
 * Deriva el origen de la aceptación a partir del campo `aceptada_por` que
 * escriben las RPCs (`manual:<email>`, `cliente_portal_token`, o el string
 * histórico de la migración de julio 2026).
 */
function derivarOrigenAceptacion(aceptadaPor: string | null | undefined): OrigenAceptacion {
  if (!aceptadaPor) return "desconocido";
  if (aceptadaPor === "cliente_portal_token") return "portal";
  if (aceptadaPor.startsWith("manual:")) return "manual";
  const lower = aceptadaPor.toLowerCase();
  if (lower.includes("migración") || lower.includes("migracion")) return "migracion";
  return "desconocido";
}

function BadgeOrigenAceptacion({ origen }: { origen: OrigenAceptacion }) {
  const config = {
    portal: { icon: Globe, label: "Cliente aceptó por portal", tip: "El cliente aceptó la proforma desde el enlace del portal público." },
    manual: { icon: UserCheck, label: "Aceptación manual", tip: "Un miembro del equipo marcó la aceptación en nombre del cliente (llamada, WhatsApp, email fuera del sistema)." },
    migracion: { icon: Archive, label: "Aceptación histórica", tip: "Aceptación registrada durante la migración de datos anteriores a julio 2026." },
    desconocido: { icon: UserCheck, label: "Aceptada", tip: "Origen de la aceptación no registrado." },
  }[origen];
  const Icon = config.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{config.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BadgeCiclo({
  estadoProforma,
  estadoCliente,
  facturas,
}: {
  estadoProforma: string | null | undefined;
  estadoCliente: EstadoCliente;
  facturas: FacturaCicloLite[];
}) {
  if (estadoProforma === "facturada") {
    // B9: distinguir "convertida a borrador" de una factura fiscal emitida.
    const label = etiquetaProformaConvertida(facturas);
    return <Badge variant={label === "Facturada" ? "success" : "info"}>{label}</Badge>;
  }
  if (estadoCliente === "rechazada") return <Badge variant="destructive">Rechazada por cliente</Badge>;
  if (estadoCliente === "aceptada") return <Badge variant="info">Aceptada</Badge>;
  return <Badge variant="warning">Pendiente cliente</Badge>;
}

export function EstadoBadges({
  estadoProforma,
  estadoCliente,
  aceptadaPor,
  facturas = [],
}: {
  estadoProforma?: string | null;
  estadoCliente?: EstadoCliente;
  /** Valor crudo de `proformas.aceptada_por`, se usa para derivar el origen. */
  aceptadaPor?: string | null;
  /** Facturas generadas desde esta proforma (para distinguir borrador vs emitida). */
  facturas?: FacturaCicloLite[];
}) {
  const ec = estadoCliente ?? "pendiente";
  const mostrarOrigen = ec === "aceptada";
  const origen = derivarOrigenAceptacion(aceptadaPor);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <BadgeCiclo estadoProforma={estadoProforma} estadoCliente={ec} facturas={facturas} />
      {mostrarOrigen && <BadgeOrigenAceptacion origen={origen} />}
    </div>
  );
}
