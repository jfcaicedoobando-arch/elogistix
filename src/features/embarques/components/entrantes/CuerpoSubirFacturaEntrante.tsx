/**
 * Cuerpo del diálogo de subida de factura entrante: agrupa las secciones de
 * archivos, proveedor, conceptos, verificación de monto y nota, para que
 * SubirFacturaEntranteDialog.tsx quede sólo con el orquestador del envío.
 */
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useSubirEntranteForm } from "@/features/cxp/hooks";
import { SeccionArchivosEntrante } from "@/features/embarques/components/entrantes/SeccionArchivosEntrante";
import { ConceptosSugeridosEntrante } from "@/features/embarques/components/entrantes/ConceptosSugeridosEntrante";
import { ResumenSubidaEntrante } from "@/features/embarques/components/entrantes/ResumenSubidaEntrante";
import { CfdiMetaPreview } from "@/features/embarques/components/entrantes/CfdiMetaPreview";
import { NotaContabilidadCampo } from "@/features/embarques/components/entrantes/NotaContabilidadCampo";
import { SeccionProveedorEntrante } from "@/features/embarques/components/entrantes/SeccionProveedorEntrante";
import { VerificacionMontoEntrante } from "@/features/embarques/components/entrantes/VerificacionMontoEntrante";
import { totalCfdiDetectado } from "@/features/embarques/components/entrantes/totalCfdiDetectado";
import { AvisoDuplicadoBuzon } from "@/features/embarques/components/entrantes/AvisoDuplicadoBuzon";
import { BuzonDuplicadoError } from "@/features/cxp";

interface Props {
  form: ReturnType<typeof useSubirEntranteForm>;
  embarqueId: string;
  duplicado: BuzonDuplicadoError | null;
  costos: { data: unknown; isLoading: boolean };
  conceptos: { data: unknown; isLoading: boolean };
}

export function CuerpoSubirFacturaEntrante({ form, embarqueId, duplicado, costos, conceptos }: Props) {
  return (
    <>
      {duplicado && (
        <AvisoDuplicadoBuzon
          mensaje={duplicado.message}
          ubicacion={duplicado.ubicacion}
          embarqueActualId={embarqueId}
        />
      )}

      <SeccionArchivosEntrante
        pdf={form.pdf}
        xml={form.xml}
        leyendoXml={form.leyendoXml}
        error={form.error}
        onArchivos={form.agregarArchivos}
        onQuitarPdf={form.quitarPdf}
        onQuitarXml={form.quitarXml}
      />

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
        title="Conceptos que cubre la factura"
        description="Marca los costos del embarque que corresponden a este documento; contabilidad los recibirá pre-marcados."
        cols={1}
      >
        <ConceptosSugeridosEntrante
          conceptos={conceptos.data}
          cargando={conceptos.isLoading}
          proveedorElegido={Boolean(form.proveedor)}
          seleccion={form.conceptos}
          sinCostoCapturado={form.sinCostoCapturado}
          onToggle={form.toggleConcepto}
          onMonto={form.setMontoConcepto}
          onSinCosto={form.marcarSinCosto}
        />
      </FormDialogSection>

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
          totalCfdi={totalCfdiDetectado(form.meta)}
          costeadoPorMoneda={costos.data}
          cargandoCostos={costos.isLoading}
          proveedorElegido={Boolean(form.proveedor)}
          sumaSugerida={form.sumaSugeridaPorMoneda[form.monedaDeclarada] ?? null}
          onUsarSumaSugerida={form.usarSumaSugerida}
        />
      </FormDialogSection>

      <FormDialogSection title="Nota para contabilidad" cols={1}>
        <NotaContabilidadCampo nota={form.nota} onNota={form.setNota} />
      </FormDialogSection>

      <ResumenSubidaEntrante
        proveedorNombre={form.proveedor?.nombre ?? null}
        monto={form.montoDeclarado}
        moneda={form.monedaDeclarada}
        archivos={{ pdf: Boolean(form.pdf), xml: Boolean(form.xml) }}
        conceptosMarcados={form.conceptosSeleccionados.length}
        sinCostoCapturado={form.sinCostoCapturado}
      />
    </>
  );
}
