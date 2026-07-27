import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, FileArchive } from "lucide-react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  exportOrganizationZip,
  EXPORT_TABLES,
  EXPORT_GROUPS,
  type ExportProgress,
} from "@/features/admin/services";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
export default function TabExportar() {
  const { organizationId, organization } = useOrganization();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [running, setRunning] = useState(false);

  const handleExport = async () => {
    if (!organizationId || !organization) {
      notifyError(undefined, { title: "No hay organización activa", method: "FEATURES_ADMIN_COMPONENTS_TABEXPORTAR_1" });
      return;
    }
    setRunning(true);
    setProgress({ step: 0, total: EXPORT_TABLES.length + 1, current: "Iniciando…", rows: 0 });
    try {
      await exportOrganizationZip(organizationId, organization.nombre, setProgress);
      notifySuccess(undefined, { title: "Export generado y descargado" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      notifyError(undefined, { title: `Falló el export: ${msg}`, error: err, method: "FEATURES_ADMIN_COMPONENTS_TABEXPORTAR_2" });
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
        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
          <p className="font-medium">
            Incluye {EXPORT_TABLES.length} tablas agrupadas por dominio:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(EXPORT_GROUPS).map(([grupo, tablas]) => (
              <div key={grupo} className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {grupo}{" "}
                  <span className="text-muted-foreground font-normal">({tablas.length})</span>
                </p>
                <p className="text-label text-muted-foreground leading-relaxed font-mono break-words">
                  {tablas.join(", ")}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t">
            Se excluyen credenciales fiscales, control de acceso y logs internos.
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
