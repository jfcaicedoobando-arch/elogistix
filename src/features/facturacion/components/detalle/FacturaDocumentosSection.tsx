/**
 * Pestaña "Documentos" del detalle de factura emitida: archivos del CFDI
 * (PDF y XML) y acuse de cancelación cuando existe. Da paridad con el
 * detalle de facturas recibidas (v13.350.0).
 */
import { FileCode2, FileText, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDescargarCfdi } from "@/features/facturacion/hooks/useDescargarCfdi";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

interface Props {
  factura: FacturaDetalle;
}

interface FilaProps {
  label: string;
  icon: React.ReactNode;
  disponible: boolean;
  onAbrir: () => void;
}

function DocumentoRow({ label, icon, disponible, onAbrir }: FilaProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-bold text-primary">
          {icon}
          {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {disponible ? "Disponible" : "No disponible"}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        disabled={!disponible}
        onClick={onAbrir}
      >
        Abrir
      </Button>
    </div>
  );
}

export function FacturaDocumentosSection({ factura }: Props) {
  const descargar = useDescargarCfdi(factura.id);
  const timbrada = !!factura.uuid_fiscal;
  const acuse = factura.acuse_cancelacion_xml ?? null;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="border-b pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-primary">
            Documentos del CFDI
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          <DocumentoRow
            label="PDF"
            icon={<FileText className="h-4 w-4" />}
            disponible={timbrada}
            onAbrir={() => void descargar(factura.factura_pdf_url ?? null, "pdf")}
          />
          <DocumentoRow
            label="XML"
            icon={<FileCode2 className="h-4 w-4" />}
            disponible={timbrada}
            onAbrir={() => void descargar(factura.factura_xml_url ?? null, "xml")}
          />
          {acuse ? (
            <DocumentoRow
              label="ACUSE"
              icon={<ShieldCheck className="h-4 w-4" />}
              disponible
              onAbrir={() => window.open(acuse, "_blank", "noopener,noreferrer")}
            />
          ) : null}
        </div>
        {!timbrada && (
          <p className="text-xs text-muted-foreground">
            Los archivos fiscales se generan al timbrar la factura.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
