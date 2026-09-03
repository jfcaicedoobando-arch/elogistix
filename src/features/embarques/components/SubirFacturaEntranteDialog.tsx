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
import { useSubirFacturaEntrante, useSubirEntranteForm } from "@/features/cxp/hooks";
import {
  useConceptosProveedorEmbarque,
  useCostosProveedorEmbarque,
} from "@/features/embarques/hooks/useEmbarqueQueries";
import { CuerpoSubirFacturaEntrante } from "@/features/embarques/components/entrantes/CuerpoSubirFacturaEntrante";
import { BuzonDuplicadoError } from "@/features/cxp";

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
    // Defecto 2: mientras la subida está en curso no se limpia ni se cierra;
    // el archivo y el estado se conservan hasta tener resultado.
    if (subir.isPending) return;
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
      busy={subir.isPending}
      icon={Inbox}
      title="Subir factura de proveedor al buzón"
      description="Los proveedores mexicanos envían PDF y XML: adjunta ambos en un solo documento. Contabilidad lo capturará como factura de proveedor."
      footer={(
        <>
          <Button variant="outline" onClick={cerrar} disabled={subir.isPending}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={subir.isPending || !form.listo} aria-busy={subir.isPending}>
            {subir.isPending ? "Subiendo…" : "Enviar al buzón"}
          </Button>
        </>
      )}
    >
      {subir.isPending && (
        <p role="status" aria-live="polite" className="text-body text-muted-foreground">
          Subiendo los archivos al buzón… no cierres esta ventana.
        </p>
      )}

      <CuerpoSubirFacturaEntrante
        form={form}
        embarqueId={embarqueId}
        duplicado={duplicado}
        costos={costos}
        conceptos={conceptos}
      />
    </FormDialogShell>
  );
}
