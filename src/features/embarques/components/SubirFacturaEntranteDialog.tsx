/**
 * Diálogo para que operaciones suba el PDF y el XML de una factura de proveedor
 * al buzón del embarque (modo archivo: no crea la factura contable).
 *
 * v13.360.0 — Un solo documento con ambos archivos + lectura del CFDI.
 * v13.503.0 — Zona de carga única con chips, verificación del monto facturado
 * contra lo costeado y nota colapsada.
 * v13.506.0 — El operador marca a qué conceptos de costo corresponde y confirma
 * con un resumen antes de enviar.
 */
import { useState } from "react";
import { Inbox } from "lucide-react";

import { notifyError } from "@/lib/ui/appFeedback";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useSubirFacturaEntrante, useSubirEntranteForm } from "@/features/cxp/hooks";
import {
  useConceptosProveedorEmbarque,
  useCostosProveedorEmbarque,
} from "@/features/embarques/hooks/useEmbarqueQueries";
import { SeccionArchivosEntrante } from "@/features/embarques/components/entrantes/SeccionArchivosEntrante";
import { ConceptosSugeridosEntrante } from "@/features/embarques/components/entrantes/ConceptosSugeridosEntrante";
import { ResumenSubidaEntrante } from "@/features/embarques/components/entrantes/ResumenSubidaEntrante";
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
  const conceptos = useConceptosProveedorEmbarque(embarqueId, form.proveedor?.id);

  // v13.819.2 — el conflicto de duplicado se muestra en línea (con su ubicación
  // y el CTA al embarque) en vez de sólo un toast que manda a una sección
  // que el operador puede no tener.
  const [duplicado, setDuplicado] = useState<BuzonDuplicadoError | null>(null);

  const cerrar = () => {
    form.limpiar();
    setDuplicado(null);
    onOpenChange(false);
  };

  const onSubmit = async () => {
    // EC-8: sin try/catch, un fallo de storage o de red dejaba una promesa
    // rechazada sin manejar y el usuario no veía nada (el diálogo se quedaba
    // "pensando").
    setDuplicado(null);
    try {
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
        conceptosSugeridos: form.conceptosSeleccionados.map((c) => ({
          conceptoId: c.conceptoId,
          monto: c.monto,
        })),
        sinCostoCapturado: form.sinCostoCapturado,
      });
      cerrar();
    } catch (error) {
      if (error instanceof BuzonDuplicadoError) {
        setDuplicado(error);
        return;
      }
      notifyError(undefined, {
        title: "No se pudo subir la factura al buzón",
        error,
        context: { embarqueId, proveedorId: form.proveedor?.id ?? null },
      });
    }
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
          totalCfdi={form.meta?.subTotal ?? form.meta?.total ?? null}
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
    </FormDialogShell>
  );
}
