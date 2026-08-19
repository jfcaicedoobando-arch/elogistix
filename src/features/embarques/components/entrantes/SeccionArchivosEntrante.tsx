/**
 * Sección de archivos del diálogo "Subir factura de proveedor al buzón".
 * Extraída para mantener el diálogo bajo el límite de complejidad.
 */
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { ArchivosEntranteDropZone } from "@/features/embarques/components/entrantes/ArchivosEntranteDropZone";

interface Props {
  pdf: File | null;
  xml: File | null;
  leyendoXml: boolean;
  error: string | null;
  onArchivos: (archivos: File[]) => void;
  onQuitarPdf: () => void;
  onQuitarXml: () => void;
}

export function SeccionArchivosEntrante({
  pdf, xml, leyendoXml, error, onArchivos, onQuitarPdf, onQuitarXml,
}: Props) {
  return (
    <FormDialogSection title="Archivos de la factura" cols={1}>
      <ArchivosEntranteDropZone
        pdf={pdf}
        xml={xml}
        onArchivos={onArchivos}
        onQuitarPdf={onQuitarPdf}
        onQuitarXml={onQuitarXml}
      />
      {leyendoXml && <p className="text-body-sm text-muted-foreground">Leyendo el XML…</p>}
      {error && <p className="text-body text-destructive">{error}</p>}
      {!xml && pdf && (
        <p className="text-body-sm text-warning">
          Sin XML sólo puede capturarse como factura extranjera. Si el proveedor es mexicano, pídele el CFDI.
        </p>
      )}
    </FormDialogSection>
  );
}
