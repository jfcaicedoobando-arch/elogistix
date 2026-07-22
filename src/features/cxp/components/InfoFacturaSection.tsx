/**
 * Sección de información de la factura de proveedor (sólo lectura).
 * v13.307.17 — Complejidad ciclomática reducida extrayendo tres sub-bloques
 * (`FechasCreditoBlock`, `DesgloseFiscalBlock`, `ReferenciasFiscalesBlock`)
 * a `InfoFacturaSection.blocks.tsx`.
 */
import { FileCode2, FileText } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useVerificarUuidSat } from "@/features/cxp/hooks/useVerificarUuidSat";
import {
  useAdjuntarArchivoCfdiFactura,
  useQuitarArchivoCfdiFactura,
} from "@/features/cxp/hooks/useAdjuntoFacturaProveedor";
import { ProgramacionPagoRow } from "@/features/cxp/components/ProgramacionPagoRow";
import { AdjuntoRow, CanceladaBanner } from "./InfoFacturaSection.parts";
import {
  FechasCreditoBlock, DesgloseFiscalBlock, ReferenciasFiscalesBlock,
} from "./InfoFacturaSection.blocks";
import type { FacturaCxP, TipoAdjuntoCfdi } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
  canEdit?: boolean;
}

export function InfoFacturaSection({ factura: f, canEdit = false }: Props) {
  const { organizationId } = useAuth();
  const verificar = useVerificarUuidSat();
  const adjuntar = useAdjuntarArchivoCfdiFactura();
  const quitar = useQuitarArchivoCfdiFactura();
  const estaCancelada = f.estado === "Cancelada";
  const verifDate = f.uuid_verificado_fecha
    ? new Date(f.uuid_verificado_fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : null;

  const puedeEditarAdjuntos = canEdit && !estaCancelada;
  const handleUpload = (file: File, tipo: TipoAdjuntoCfdi) =>
    adjuntar.mutate({ facturaId: f.id, organizationId, tipo, file });
  const handleRemove = (path: string, tipo: TipoAdjuntoCfdi) =>
    quitar.mutate({ facturaId: f.id, path, tipo });
  const busyTipo = adjuntar.isPending
    ? adjuntar.variables?.tipo
    : quitar.isPending ? quitar.variables?.tipo : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-primary">
          Información de la factura
        </h3>
      </div>

      {estaCancelada && (
        <CanceladaBanner fecha={f.fecha_cancelacion} motivo={f.motivo_cancelacion} />
      )}

      <FechasCreditoBlock f={f} />
      <DesgloseFiscalBlock f={f} />
      <ReferenciasFiscalesBlock
        f={f}
        verifDate={verifDate}
        isVerifying={verificar.isPending}
        onVerify={() => verificar.mutate(f.id)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">CFDI adjuntos</h4>
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
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Programación de pago</h4>
          <ProgramacionPagoRow
            facturaId={f.id}
            fechaProgramada={f.fecha_programada_pago}
            saldo={f.saldo}
          />
        </div>
      </div>

      {f.notas && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Notas</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
            {f.notas}
          </p>
        </div>
      )}
    </section>
  );
}
