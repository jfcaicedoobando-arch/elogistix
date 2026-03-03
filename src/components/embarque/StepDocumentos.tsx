import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentChecklist, { type DocumentoChecklist } from "@/components/DocumentChecklist";

interface Props {
  documentos: DocumentoChecklist[];
  onFileChange: (docNombre: string, file: File | undefined) => void;
}

export function StepDocumentos({ documentos, onFileChange }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle>Documentos Requeridos</CardTitle></CardHeader>
      <CardContent>
        <DocumentChecklist
          documentos={documentos}
          onFileChange={onFileChange}
          descripcion="Adjunta los documentos requeridos para este embarque. Podrás agregar más después."
        />
      </CardContent>
    </Card>
  );
}
