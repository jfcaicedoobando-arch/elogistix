/**
 * Sección de información adicional de una factura de proveedor:
 * categoría contable, datos fiscales, desglose, CFDI adjuntos y notas.
 * Sólo lectura.
 */
import { Info, FileCode, FileText, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openFacturaInNewTab } from "@/services/storage/facturas";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { useVerificarUuidSat } from "@/features/cxp/hooks/useVerificarUuidSat";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-sm text-foreground truncate ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

async function handleAbrir(path: string, tipo: "XML" | "PDF") {
  try {
    await openFacturaInNewTab(path);
  } catch (e) {
    notifyError(toast, {
      title: `No se pudo abrir el ${tipo} del CFDI`,
      error: e,
      method: "FEATURES_CXP_INFOFACTURA_OPEN_CFDI",
    });
  }
}

function AdjuntoRow({
  label, icon, path, tipo,
}: { label: string; icon: React.ReactNode; path: string | null; tipo: "XML" | "PDF" }) {
  const adjunto = !!path;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        {adjunto ? (
          <Badge variant="default" className="bg-success hover:bg-success">Adjunto</Badge>
        ) : (
          <Badge variant="secondary">No adjunto</Badge>
        )}
      </div>
      {adjunto && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAbrir(path, tipo)}
          className="h-8"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
        </Button>
      )}
    </div>
  );
}

export function InfoFacturaSection({ factura: f }: Props) {
  const showTc = f.moneda !== "MXN";
  return (
    <section className="px-6 py-4 border-b bg-muted/10">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span>Información de la factura</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        <Field label="Categoría contable" value={f.categoria_nombre} />
        <Field label="RFC proveedor" value={f.rfc_proveedor} mono />
        <Field label="UUID fiscal (CFDI)" value={f.uuid_fiscal} mono />
        <Field label="Subtotal" value={<span className="tabular-nums">{formatCurrency(f.subtotal, f.moneda)}</span>} />
        <Field label="IVA" value={<span className="tabular-nums">{formatCurrency(f.iva, f.moneda)}</span>} />
        <Field label="Retenciones" value={<span className="tabular-nums">{formatCurrency(f.retenciones, f.moneda)}</span>} />
        <Field
          label="Moneda"
          value={
            <span>
              {f.moneda}
              {showTc && f.tipo_cambio_usd > 0 && (
                <span className="text-muted-foreground text-xs ml-1.5">
                  · TC {f.tipo_cambio_usd.toFixed(4)}
                </span>
              )}
            </span>
          }
        />
        <Field
          label="Días de crédito"
          value={f.dias_credito != null ? `${f.dias_credito} días` : null}
        />
        <Field
          label="Embarque"
          value={f.embarque_id ? <span className="font-mono text-xs">{f.embarque_id.slice(0, 8)}…</span> : null}
        />
      </div>

      <div className="mt-4 pt-3 border-t">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">
          CFDI adjuntos
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <AdjuntoRow
            label="XML"
            icon={<FileCode className="h-4 w-4" />}
            path={f.archivo_xml_url}
            tipo="XML"
          />
          <AdjuntoRow
            label="PDF"
            icon={<FileText className="h-4 w-4" />}
            path={f.archivo_pdf_url}
            tipo="PDF"
          />
        </div>
      </div>

      {f.notas && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Notas
          </span>
          <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{f.notas}</p>
        </div>
      )}
    </section>
  );
}
