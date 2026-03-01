import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocsForMode } from "@/data/embarqueConstants";

interface Props {
  modo: string;
}

export function StepDocumentos({ modo }: Props) {
  const docs = getDocsForMode(modo);

  return (
    <Card>
      <CardHeader><CardTitle>Documentos Requeridos</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <span className="text-sm font-medium">{doc}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pendiente</span>
                <Button variant="outline" size="sm">Subir</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
