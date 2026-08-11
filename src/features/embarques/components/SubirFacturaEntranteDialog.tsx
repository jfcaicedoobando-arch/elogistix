/**
 * Diálogo para que operaciones suba el PDF y el XML de una factura de proveedor
 * al buzón del embarque (modo archivo: no crea la factura contable).
 *
 * v13.360.0 — Un solo documento con ambos archivos + lectura del CFDI.
 * v13.503.0 — Zona de carga única con chips, verificación del monto facturado
 * contra lo costeado y nota colapsada.
 */
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useSubirFacturaEntrante } from "@/features/cxp/hooks/useFacturasEntrantes";
import { useSubirEntranteForm } from "@/features/cxp/hooks/useSubirEntranteForm";
import { useCostosProveedorEmbarque } from "@/features/embarques/hooks/useEmbarqueQueries";
import { ArchivosEntranteDropZone } from "@/features/embarques/components/entrantes/ArchivosEntranteDropZone";
import { CfdiMetaPreview } from "@/features/embarques/components/entrantes/CfdiMetaPreview";
import { NotaContabilidadCampo } from "@/features/embarques/components/entrantes/NotaContabilidadCampo";
import { SeccionProveedorEntrante } from "@/features/embarques/components/entrantes/SeccionProveedorEntrante";
import { VerificacionMontoEntrante } from "@/features/embarques/components/entrantes/VerificacionMontoEntrante";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  organizationId: string;
}

export function SubirFacturaEntranteDialog({ open, onOpenChange, embarqueId, organizationId }: Props) {
  const form = useSubirEntranteForm({ organizationId });
  const subir = useSubirFacturaEntrante();
  const costos = useCostosProveedorEmbarque(embarqueId, form.proveedor?.id);

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
      montoDeclarado: form.montoDeclarado,
      monedaDeclarada: form.monedaDeclarada,
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

      <SeccionProveedorEntrante
        embarqueId={embarqueId}
        seleccionado={form.proveedor}
        detectado={form.proveedorDetectado}
        rfcEmisor={form.meta?.rfcEmisor ?? null}
        tieneXml={Boolean(form.xml)}
        onSeleccionar={form.setProveedor}
      />

      <FormDialogSection
        title="Verificación del monto"
        description="Compara lo que facturó el proveedor contra lo costeado en el embarque."
        cols={1}
      >
        <VerificacionMontoEntrante
          monto={form.montoDeclarado}
          moneda={form.monedaDeclarada}
          onMonto={form.setMontoDeclarado}
          onMoneda={form.setMonedaDeclarada}
          totalCfdi={form.meta?.total ?? null}
          costeadoPorMoneda={costos.data}
          cargandoCostos={costos.isLoading}
          proveedorElegido={Boolean(form.proveedor)}
        />
      </FormDialogSection>

      <FormDialogSection title="Nota para contabilidad" cols={1}>
        <NotaContabilidadCampo nota={form.nota} onNota={form.setNota} />
      </FormDialogSection>
    </FormDialogShell>
  );
}
