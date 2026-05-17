import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, FileArchive } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { exportOrganizationZip, EXPORT_TABLES, type ExportProgress } from "@/utils/orgExportZip";
import { toast } from "sonner";

export default function TabExportar() {
  const { organizationId, organization } = useOrganization();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [running, setRunning] = useState(false);

  const handleExport = async () => {
    if (!organizationId || !organization) {
      toast.error("No hay organización activa");
      return;
    }
    setRunning(true);
    setProgress({ step: 0, total: EXPORT_TABLES.length + 1, current: "Iniciando…", rows: 0 });
    try {
      await exportOrganizationZip(organizationId, organization.nombre, setProgress);
      toast.success("Export generado y descargado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Falló el export: ${msg}`);
    } finally {
      setRunning(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const pct = progress ? Math.round((progress.step / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5 text-primary" />
          Exportar datos de la organización
        </CardTitle>
        <CardDescription>
          Genera un archivo ZIP con todos los datos operativos de tu organización en formato CSV.
          Útil como respaldo manual o para análisis externo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium mb-2">Incluye {EXPORT_TABLES.length} tablas:</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {EXPORT_TABLES.join(", ")}
          </p>
        </div>

        <Button onClick={handleExport} disabled={running} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {running ? "Generando…" : "Descargar ZIP"}
        </Button>

        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {progress.step} / {progress.total} · <span className="font-mono">{progress.current}</span>
                {progress.rows > 0 ? ` (${progress.rows} filas)` : ""}
              </span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Los datos se procesan en tu navegador. No se envían a terceros. El ZIP queda en tu carpeta de descargas.
        </p>
      </CardContent>
    </Card>
  );
}
