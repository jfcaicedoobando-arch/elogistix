/**
 * Diálogo para que operaciones suba el PDF y el XML de una factura de proveedor
 * al buzón del embarque (modo archivo: no crea la factura contable).
 *
 * v13.360.0 — Un solo documento con ambos archivos + lectura del CFDI.
 */
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useSubirFacturaEntrante } from "@/features/cxp/hooks/useFacturasEntrantes";
import { useSubirEntranteForm } from "@/features/cxp/hooks/useSubirEntranteForm";
import { ArchivosEntranteDropZone } from "@/features/embarques/components/entrantes/ArchivosEntranteDropZone";
import { CfdiMetaPreview } from "@/features/embarques/components/entrantes/CfdiMetaPreview";
import { SelectorProveedorEntrante } from "@/features/embarques/components/entrantes/SelectorProveedorEntrante";
import { avisoProveedorEntrante } from "@/lib/domain/proveedorEntrante";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  organizationId: string;
}

export function SubirFacturaEntranteDialog({ open, onOpenChange, embarqueId, organizationId }: Props) {
  const form = useSubirEntranteForm({ organizationId });
  const subir = useSubirFacturaEntrante();

  const aviso = avisoProveedorEntrante({
    detectadoId: form.proveedorDetectado?.id ?? null,
    detectadoNombre: form.proveedorDetectado?.nombre ?? null,
    seleccionadoId: form.proveedor?.id ?? null,
    rfcEmisor: form.meta?.rfcEmisor ?? null,
    tieneXml: Boolean(form.xml),
  });

  const cerrar = () => {
    form.limpiar();
    onOpenChange(false);
  };

  const onSubmit = async () => {
    await subir.mutateAsync({
      pdf: form.pdf,
      xml: form.xml,
      meta: form.meta,
      proveedorId: form.proveedor?.id ?? null,
      embarqueId,
      organizationId,
      nota: form.nota,
    });
    cerrar();
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => { if (!v) cerrar(); }}
      icon={Inbox}
      title="Subir factura de proveedor al buzón"
      description="Los proveedores mexicanos envían PDF y XML: adjunta ambos en un solo documento. Contabilidad lo capturará como factura de proveedor."
      footer={(
        <>
          <Button variant="outline" onClick={cerrar} disabled={subir.isPending}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={subir.isPending || !form.listo}>
            {subir.isPending ? "Subiendo…" : "Enviar al buzón"}
          </Button>
        </>
      )}
    >
      <FormDialogSection title="Archivos de la factura" cols={1}>
        <ArchivosEntranteDropZone
          pdf={form.pdf}
          xml={form.xml}
          onArchivos={form.agregarArchivos}
          onQuitarPdf={form.quitarPdf}
          onQuitarXml={form.quitarXml}
        />
        {form.leyendoXml && <p className="text-xs text-muted-foreground">Leyendo el XML…</p>}
        {form.error && <p className="text-sm text-destructive">{form.error}</p>}
        {!form.xml && form.pdf && (
          <p className="text-xs text-warning">
            Sin XML sólo puede capturarse como factura extranjera. Si el proveedor es mexicano, pídele el CFDI.
          </p>
        )}
      </FormDialogSection>

      {form.meta && !form.leyendoXml && (
        <FormDialogSection title="Datos detectados" cols={1}>
          <CfdiMetaPreview meta={form.meta} metaUtil={form.metaUtil} />
        </FormDialogSection>
      )}

      <FormDialogSection title="Proveedor" cols={1}>
        <div className="space-y-2">
          <Label>¿A qué proveedor del embarque corresponde?</Label>
          <SelectorProveedorEntrante
            embarqueId={embarqueId}
            seleccionado={form.proveedor}
            detectadoId={form.proveedorDetectado?.id ?? null}
            onSeleccionar={form.setProveedor}
          />
          {aviso && <p className="text-xs text-warning">{aviso}</p>}
        </div>
      </FormDialogSection>

      <FormDialogSection title="Nota para contabilidad" cols={1}>
        <div className="space-y-2">
          <Label htmlFor="factura-entrante-nota">Opcional</Label>
          <Textarea
            id="factura-entrante-nota"
            value={form.nota}
            onChange={(e) => form.setNota(e.target.value)}
            placeholder="Ej. Invoice del agente en Shanghái, incluye THC destino."
            rows={3}
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
