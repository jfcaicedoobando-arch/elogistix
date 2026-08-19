/**
 * Encabezado del expediente: caso, ruta fiscal, facturas y pagos involucrados.
 */
import { Badge } from "@/components/ui/badge";
import { formatFechaEs, formatFechaHoraTexto } from "@/lib/formatters";
import { RefacturacionPagosLista } from "./RefacturacionPagosLista";
import type { RefacturacionExpediente } from "@/features/facturacion/services/refacturacionExpediente";

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  abierto: "default",
  completado: "secondary",
  cancelado: "destructive",
};

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-body-sm text-muted-foreground">{label}</p>
      <p className="text-body font-medium break-words">{children}</p>
    </div>
  );
}

const ESTADO_LABEL: Record<string, string> = {
  abierto: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

function textoFacturaOriginal(f: RefacturacionExpediente["factura_original"]): string {
  if (!f) return "—";
  const base = `${f.numero ?? "—"} · ${f.estado}`;
  return f.cancelado_en ? `${base} (cancelada el ${formatFechaEs(f.cancelado_en)})` : base;
}

function textoFacturaNueva(f: RefacturacionExpediente["factura_nueva"]): string {
  if (!f) return "Sin generar";
  return `${f.numero ?? "Borrador"} · ${f.estado}`;
}

export function RefacturacionExpedienteResumen({ exp }: { exp: RefacturacionExpediente }) {
  const { caso } = exp;
  const abiertoPor = caso.creado_por_email ? ` por ${caso.creado_por_email}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ESTADO_VARIANT[caso.estado] ?? "outline"}>
          {ESTADO_LABEL[caso.estado] ?? caso.estado}
        </Badge>
        <Badge variant="outline">
          Ruta {caso.ruta_fiscal} · {caso.ruta_fiscal === "01" ? "sustitución" : "factura nueva sin relación"}
        </Badge>
        <span className="text-body-sm text-muted-foreground">
          Abierto el {formatFechaHoraTexto(caso.created_at)}{abiertoPor}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Dato label="Receptor original">{caso.cliente_origen ?? "—"}</Dato>
        <Dato label="Receptor correcto">{caso.cliente_destino ?? "—"}</Dato>
        <Dato label="Factura original">{textoFacturaOriginal(exp.factura_original)}</Dato>
        <Dato label="Factura nueva">{textoFacturaNueva(exp.factura_nueva)}</Dato>
        <Dato label="Expediente del embarque">{caso.embarque_expediente ?? "Sin embarque ligado"}</Dato>
        <Dato label="Motivo">{caso.motivo || "—"}</Dato>
      </div>


      <RefacturacionPagosLista pagos={exp.pagos} />
    </div>
  );
}
