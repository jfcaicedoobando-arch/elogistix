/**
 * Sub-vista del resultado (extraída para reducir la complejidad del dialog padre).
 * Incluye la acción manual "Limpiar estado local (verificado)" cuando FacturAPI
 * confirma en vivo que no hay solicitud de cancelación abierta pero la factura
 * local sigue con `cancellation_status = pending`/`verifying`.
 */
import { AlertCircle, CheckCircle2, Eraser } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLimpiarPendingVerificado } from "@/features/facturacion/hooks/useLimpiarPendingVerificado";
import type { ConsultarFacturapiResult } from "@/features/facturacion/services/facturapi";

function fmt(v: string | null | undefined): string {
  return v ? v : "—";
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs truncate max-w-[60%]" : "font-medium"}>{value}</span>
    </div>
  );
}

function RemotoCard({ r }: { r: ConsultarFacturapiResult["remoto"] }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase">En FacturApi</div>
      <Row label="status" value={fmt(r.status)} />
      <Row label="cancellation_status" value={fmt(r.cancellation_status)} />
      <Row label="canceled_at" value={r.canceled_at ?? "—"} />
      <Row label="UUID" value={r.uuid ?? "—"} mono />
      <Row label="Folio" value={r.folio ? `${r.serie ?? ""}${r.folio}` : "—"} />
    </div>
  );
}

function LocalCard({ l }: { l: ConsultarFacturapiResult["local"] }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase">En Libre Carga</div>
      <Row label="estado" value={fmt(l.estado)} />
      <Row label="cancellation_status" value={fmt(l.cancellation_status)} />
      <Row label="UUID" value={l.uuid_fiscal ?? "—"} mono />
    </div>
  );
}

function DivergenciasAlert({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold mb-1">Divergencias detectadas:</div>
        <ul className="list-disc ml-4 text-sm space-y-1">
          {items.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function RelacionadosList({ docs }: { docs: ConsultarFacturapiResult["remoto"]["related_documents"] }) {
  if (docs.length === 0) return null;
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
        Documentos relacionados ({docs.length})
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Si el SAT rechaza la cancelación, revisa que estos documentos ya estén cancelados también.
      </p>
      <ul className="text-sm space-y-1">
        {docs.map((doc, idx) => (
          <li key={idx} className="flex items-center gap-2 flex-wrap">
            {doc.relationship && <Badge variant="outline">{doc.relationship}</Badge>}
            {doc.folio && <span>{doc.serie ?? ""}{doc.folio}</span>}
            {doc.uuid && <span className="text-xs font-mono text-muted-foreground">{doc.uuid}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DialogConsultarFacturapiResult({ data }: { data: ConsultarFacturapiResult }) {
  const enSync = data.divergencias.length === 0 && !data.reconciliada;
  return (
    <div className="space-y-4">
      {data.reconciliada && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Se detectó divergencia y la factura local se reconcilió con FacturApi.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RemotoCard r={data.remoto} />
        <LocalCard l={data.local} />
      </div>
      <DivergenciasAlert items={data.divergencias} />
      <RelacionadosList docs={data.remoto.related_documents} />
      {enSync && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            El estado local coincide con lo que FacturApi reporta.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
