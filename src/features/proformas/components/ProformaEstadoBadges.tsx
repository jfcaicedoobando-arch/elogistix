/**
 * Badges de estado del ciclo de la proforma y del origen de aceptación.
 * Extraído de `ProformaDetalleCards` para respetar Power-of-10 #4 (≤200 líneas).
 */
import { Globe, UserCheck, Archive, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  etiquetaProformaConvertida,
  type FacturaCicloLite,
} from "@/lib/domain/etiquetaCicloProforma";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  derivarOrigenAceptacion,
  type OrigenAceptacion,
} from "@/features/proformas/domain/origenAceptacion";

export type EstadoCliente = "pendiente" | "aceptada" | "rechazada";
export type { OrigenAceptacion };

function BadgeOrigenAceptacion({ origen }: { origen: OrigenAceptacion }) {
  const config = {
    portal: { icon: Globe, label: "Cliente aceptó por portal", tip: "El cliente aceptó la proforma desde el enlace del portal público." },
    manual: { icon: UserCheck, label: "Aceptación manual", tip: "Un miembro del equipo marcó la aceptación en nombre del cliente (llamada, WhatsApp, email fuera del sistema)." },
    migracion: { icon: Archive, label: "Aceptación histórica", tip: "Aceptación registrada durante la migración de datos anteriores a julio 2026." },
    interna: {
      icon: ShieldCheck,
      label: "Aprobación interna",
      tip: "El cliente no requiere autorización de crédito para esta proforma; un miembro autorizado del equipo la aprobó internamente.",
    },
    desconocido: { icon: UserCheck, label: "Origen no registrado", tip: "Origen de la aceptación no registrado." },
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
  requiereAutorizacionProforma,
  facturas,
}: {
  estadoProforma: string | null | undefined;
  estadoCliente: EstadoCliente;
  requiereAutorizacionProforma: boolean;
  facturas: FacturaCicloLite[];
}) {
  if (estadoProforma === "facturada") {
    // B9: distinguir "convertida a borrador" de una factura fiscal emitida.
    const label = etiquetaProformaConvertida(facturas);
    return <Badge variant={label === "Facturada" ? "success" : "info"}>{label}</Badge>;
  }
  if (estadoCliente === "rechazada") {
    return <Badge variant="destructive">{requiereAutorizacionProforma ? "Rechazada por cliente" : "Rechazada"}</Badge>;
  }
  if (estadoCliente === "aceptada") {
    return (
      <Badge variant="info">
        {requiereAutorizacionProforma ? "Aceptada" : "Aprobada internamente"}
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      {requiereAutorizacionProforma ? "Pendiente cliente" : "Pendiente aprobación interna"}
    </Badge>
  );
}

export function EstadoBadges({
  estadoProforma,
  estadoCliente,
  aceptadaPor,
  facturas = [],
  requiereAutorizacionProforma = true,
}: {
  estadoProforma?: string | null;
  estadoCliente?: EstadoCliente;
  /** Valor crudo de `proformas.aceptada_por`, se usa para derivar el origen. */
  aceptadaPor?: string | null;
  /** Facturas generadas desde la proforma (para distinguir borrador vs emitida). */
  facturas?: FacturaCicloLite[];
  /** false for customers whose proformas use an internal approval workflow. */
  requiereAutorizacionProforma?: boolean;
}) {
  const ec = estadoCliente ?? "pendiente";
  const mostrarOrigen = ec === "aceptada" && requiereAutorizacionProforma;
  const origen = derivarOrigenAceptacion(aceptadaPor);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <BadgeCiclo
        estadoProforma={estadoProforma}
        estadoCliente={ec}
        requiereAutorizacionProforma={requiereAutorizacionProforma}
        facturas={facturas}
      />
      {mostrarOrigen && <BadgeOrigenAceptacion origen={origen} />}
    </div>
  );
}
