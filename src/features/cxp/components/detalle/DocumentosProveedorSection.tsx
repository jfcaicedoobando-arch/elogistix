/**
 * Pestaña "Documentos" del detalle de factura de proveedor: adjuntos del
 * CFDI (XML y PDF). Extraído de `InfoFacturaSection` para dar paridad con
 * el detalle de facturas emitidas (v13.350.0).
 * v13.427.0 — Respaldo: si faltan los adjuntos propios se ofrecen los del
 * documento del buzón que originó la factura.
 */
import { FileCode2, FileText, Paperclip } from "lucide-react";
import { DocumentoSectionTitle } from "@/components/shared/documento/DocumentoSectionTitle";
import {
  useAdjuntarArchivoCfdiFactura,
  useQuitarArchivoCfdiFactura,
} from "@/features/cxp/hooks/useAdjuntoFacturaProveedor";
import { useEntranteDeFactura } from "@/features/cxp/hooks/useEntranteDeFactura";
import { AdjuntoRow } from "@/features/cxp/components/InfoFacturaSection.parts";
import { AdjuntosDelBuzon } from "./AdjuntosDelBuzon";
import type { FacturaCxP, TipoAdjuntoCfdi } from "@/features/cxp/services";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

interface Props {
  factura: FacturaCxP;
  canEdit?: boolean;
}

export function DocumentosProveedorSection({ factura: f, canEdit = false }: Props) {
  const { organizationId } = useOrgActiva();
  const adjuntar = useAdjuntarArchivoCfdiFactura();
  const quitar = useQuitarArchivoCfdiFactura();
  const puedeEditarAdjuntos = canEdit && f.estado !== "Cancelada";
  const faltaPdf = !f.archivo_pdf_url;
  const faltaXml = !f.archivo_xml_url;
  const { data: entrante } = useEntranteDeFactura(f.id, faltaPdf || faltaXml);

  const handleUpload = (file: File, tipo: TipoAdjuntoCfdi) =>
    adjuntar.mutate({ facturaId: f.id, organizationId, tipo, file });
  const handleRemove = (path: string, tipo: TipoAdjuntoCfdi) =>
    quitar.mutate({ facturaId: f.id, path, tipo });
  const busyTipo = adjuntar.isPending
    ? adjuntar.variables?.tipo
    : quitar.isPending ? quitar.variables?.tipo : undefined;


  return (
    <section className="space-y-3">
      <DocumentoSectionTitle
        title="Documentos del CFDI"
        icon={<Paperclip className="h-4 w-4" />}
      />
      <div className="flex flex-col gap-2">
        <AdjuntoRow
          label="XML" icon={<FileCode2 className="h-4 w-4" />}
          path={f.archivo_xml_url} tipo="XML"
          canEdit={puedeEditarAdjuntos}
          isUploading={busyTipo === "XML"}
          onUpload={handleUpload} onRemove={handleRemove}
        />
        <AdjuntoRow
          label="PDF" icon={<FileText className="h-4 w-4" />}
          path={f.archivo_pdf_url} tipo="PDF"
          canEdit={puedeEditarAdjuntos}
          isUploading={busyTipo === "PDF"}
          onUpload={handleUpload} onRemove={handleRemove}
        />
      </div>
      {entrante && (
        <AdjuntosDelBuzon entrante={entrante} faltaPdf={faltaPdf} faltaXml={faltaXml} />
      )}
      <p className="text-xs text-muted-foreground">
        El XML es la fuente fiscal del documento; el PDF es la representación
        impresa que envía el proveedor.
      </p>
    </section>
  );
}
