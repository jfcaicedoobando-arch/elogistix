/**
 * Sección "Proveedor" del modal de subida al buzón CxP:
 * selector + aviso de discrepancia contra el RFC del CFDI.
 */
import { Label } from "@/components/ui/label";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import {
  SelectorProveedorEntrante,
  type ProveedorOpcion,
} from "@/features/embarques/components/entrantes/SelectorProveedorEntrante";
import { avisoProveedorEntrante } from "@/lib/domain/proveedorEntrante";

interface Props {
  embarqueId: string;
  seleccionado: ProveedorOpcion | null;
  detectado: ProveedorOpcion | null;
  rfcEmisor: string | null;
  tieneXml: boolean;
  onSeleccionar: (proveedor: ProveedorOpcion | null) => void;
}

export function SeccionProveedorEntrante({
  embarqueId,
  seleccionado,
  detectado,
  rfcEmisor,
  tieneXml,
  onSeleccionar,
}: Props) {
  const aviso = avisoProveedorEntrante({
    detectadoId: detectado?.id ?? null,
    detectadoNombre: detectado?.nombre ?? null,
    seleccionadoId: seleccionado?.id ?? null,
    rfcEmisor,
    tieneXml,
  });

  return (
    <FormDialogSection title="Proveedor" cols={1}>
      <div className="space-y-2">
        <Label>
          ¿A qué proveedor del embarque corresponde? <span className="text-destructive">*</span>
        </Label>
        <SelectorProveedorEntrante
          embarqueId={embarqueId}
          seleccionado={seleccionado}
          detectadoId={detectado?.id ?? null}
          onSeleccionar={onSeleccionar}
        />
        {!seleccionado && (
          <p className="text-xs text-muted-foreground">
            Elige el proveedor para poder enviar el documento al buzón.
          </p>
        )}
        {aviso && <p className="text-xs text-warning">{aviso}</p>}
      </div>
    </FormDialogSection>
  );
}
