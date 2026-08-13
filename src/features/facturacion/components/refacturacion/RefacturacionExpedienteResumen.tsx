/**
 * Encabezado del expediente: caso, ruta fiscal, facturas y pagos involucrados.
 */
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatFechaEs, formatFechaHoraTexto } from "@/lib/formatters";
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

      {exp.pagos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Pagos involucrados</p>
          <ul className="space-y-1">
            {exp.pagos.map((p) => (
              <li key={p.id} className="rounded-md border p-2 text-xs">
                <span className="font-medium">{formatCurrency(Number(p.monto), p.moneda)}</span>
                {" · "}{formatFechaEs(p.fecha_pago)}
                {" · "}{p.es_nuevo ? "aplicado a la factura nueva" : "pago original"}
                {p.deleted_at ? " · dado de baja" : ""}
                {p.uuid_rep ? (p.rep_cancelado_en ? " · REP cancelado" : " · REP vigente") : " · sin REP"}
                {p.ordenante_nombre ? ` · pagó ${p.ordenante_nombre}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
