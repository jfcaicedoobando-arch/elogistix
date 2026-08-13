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
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{children}</p>
    </div>
  );
}

export function RefacturacionExpedienteResumen({ exp }: { exp: RefacturacionExpediente }) {
  const { caso, factura_original: original, factura_nueva: nueva } = exp;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ESTADO_VARIANT[caso.estado] ?? "outline"}>
          {caso.estado === "abierto" ? "En proceso" : caso.estado === "completado" ? "Completado" : "Cancelado"}
        </Badge>
        <Badge variant="outline">
          Ruta {caso.ruta_fiscal} · {caso.ruta_fiscal === "01" ? "sustitución" : "factura nueva sin relación"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Abierto el {formatFechaHoraTexto(caso.created_at)}
          {caso.creado_por_email ? ` por ${caso.creado_por_email}` : ""}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Dato label="Receptor original">{caso.cliente_origen ?? "—"}</Dato>
        <Dato label="Receptor correcto">{caso.cliente_destino ?? "—"}</Dato>
        <Dato label="Factura original">
          {original?.numero ?? "—"} · {original?.estado ?? "—"}
          {original?.cancelado_en ? ` (cancelada el ${formatFechaEs(original.cancelado_en)})` : ""}
        </Dato>
        <Dato label="Factura nueva">
          {nueva ? `${nueva.numero ?? "Borrador"} · ${nueva.estado}` : "Sin generar"}
        </Dato>
        <Dato label="Expediente del embarque">{caso.embarque_expediente ?? "Sin embarque ligado"}</Dato>
        <Dato label="Motivo">{caso.motivo || "—"}</Dato>
      </div>

      <RefacturacionPagosLista pagos={exp.pagos} />
    </div>
  );
}
