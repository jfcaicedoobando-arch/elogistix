/**
 * v13.508.0 — Diálogo para corregir los datos declarados de un documento que ya
 * está en el buzón (proveedor, monto, conceptos sugeridos y nota).
 *
 * Los archivos no se tocan: es la corrección de captura que antes obligaba a
 * retirar el documento y volverlo a subir.
 */
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useCorregirDatosEntrante } from "@/features/cxp/hooks";
import { useCorregirEntranteForm } from "@/features/cxp/hooks";
import {
  useConceptosProveedorEmbarque,
  useCostosProveedorEmbarque,
} from "@/features/embarques/hooks/useEmbarqueQueries";
import { ConceptosSugeridosEntrante } from "@/features/embarques/components/entrantes/ConceptosSugeridosEntrante";
import { NotaContabilidadCampo } from "@/features/embarques/components/entrantes/NotaContabilidadCampo";
import { SeccionProveedorEntrante } from "@/features/embarques/components/entrantes/SeccionProveedorEntrante";
import { VerificacionMontoEntrante } from "@/features/embarques/components/entrantes/VerificacionMontoEntrante";
import type { FacturaEntranteRow } from "@/features/cxp/services";

interface Props {
  row: FacturaEntranteRow | null;
  onOpenChange: (open: boolean) => void;
}

export function CorregirDatosEntranteDialog({ row, onOpenChange }: Props) {
  const form = useCorregirEntranteForm(row);
  const corregir = useCorregirDatosEntrante();
  const embarqueId = row?.embarque_id ?? "";
  const costos = useCostosProveedorEmbarque(embarqueId, form.proveedor?.id);
  const conceptos = useConceptosProveedorEmbarque(embarqueId, form.proveedor?.id);

  const onSubmit = async () => {
    if (!row) return;
    await corregir.mutateAsync({
      id: row.id,
      nombreArchivo: row.nombre_archivo,
      proveedorId: form.proveedor?.id ?? null,
      montoDeclarado: form.montoDeclarado,
      monedaDeclarada: form.monedaDeclarada,
      nota: form.nota,
      sinCostoCapturado: form.sinCostoCapturado,
      conceptos: form.conceptosSeleccionados.map((c) => ({
        conceptoId: c.conceptoId,
        monto: c.monto,
      })),
    });
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={Boolean(row)}
      onOpenChange={onOpenChange}
      icon={PencilLine}
      title="Corregir datos del documento"
      description={`Ajusta lo que declaraste al subir ${row?.nombre_archivo ?? "el archivo"}. Los archivos PDF/XML no cambian.`}
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={corregir.isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={corregir.isPending || !form.listo}>
            {corregir.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      )}
    >
      <SeccionProveedorEntrante
        embarqueId={embarqueId}
        seleccionado={form.proveedor}
        detectado={null}
        rfcEmisor={row?.rfc_emisor ?? null}
        tieneXml={Boolean(row?.xml_path)}
        onSeleccionar={form.setProveedor}
      />

      <FormDialogSection
        title="Conceptos que cubre la factura"
        description="Marca los costos del embarque que corresponden a este documento."
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
          totalCfdi={row?.total_detectado != null ? Number(row.total_detectado) : null}
          costeadoPorMoneda={costos.data}
          cargandoCostos={costos.isLoading}
          proveedorElegido={Boolean(form.proveedor)}
          sumaSugerida={form.conceptosSeleccionados
            .filter((c) => c.moneda === form.monedaDeclarada)
            .reduce((acc, c) => acc + c.monto, 0)}
          onUsarSumaSugerida={form.usarSumaSugerida}
        />
      </FormDialogSection>

      <FormDialogSection title="Nota para contabilidad" cols={1}>
        <NotaContabilidadCampo nota={form.nota} onNota={form.setNota} />
      </FormDialogSection>
    </FormDialogShell>
  );
}
