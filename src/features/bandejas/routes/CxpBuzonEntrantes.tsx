/**
 * Buzón CxP: facturas de proveedor entregadas por operación y aún sin capturar.
 *
 * Contabilidad abre el archivo, captura la factura de proveedor desde el
 * embarque correspondiente y marca el documento como capturado o rechazado.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Inbox, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatDate } from "@/lib/formatters/dates";
import { notifyError } from "@/lib/ui/appFeedback";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { diasEnEspera } from "@/lib/domain/facturasEntrantes";
import {
  useFacturasEntrantesPendientes,
  useRechazarFacturaEntrante,
} from "@/features/cxp/hooks/useFacturasEntrantes";
import { abrirFacturaEntrante, type FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";
import { RechazarFacturaEntranteDialog } from "@/features/bandejas/components/RechazarFacturaEntranteDialog";

export default function CxpBuzonEntrantes() {
  const { canCapturarFacturaProveedor } = usePermissions();
  const { data: pendientes = [], isLoading } = useFacturasEntrantesPendientes();
  const rechazar = useRechazarFacturaEntrante();
  const [aRechazar, setARechazar] = useState<FacturaEntranteRow | null>(null);
  const [soloSinXml, setSoloSinXml] = useState(false);

  const abrirArchivo = async (path: string, nombre: string) => {
    try {
      await abrirFacturaEntrante(path, nombre);
    } catch (error) {
      notifyError(undefined, { title: "No se pudo abrir el archivo", error, method: "ABRIR_FACTURA_ENTRANTE" });
    }
  };

  // v13.360.0 — Un CFDI mexicano sin XML no es deducible: se resalta y se filtra.
  const sinXml = (row: FacturaEntranteRow) => faltaXmlFiscal({
    esNacional: (row.proveedores?.origen ?? "Nacional") === "Nacional",
    tieneXml: chipsArchivosEntrante(row).includes("xml"),
  });
  const totalSinXml = pendientes.filter(sinXml).length;
  const data = soloSinXml ? pendientes.filter(sinXml) : pendientes;


  const masDeTresDias = data.filter((row) => diasEnEspera(row.created_at) >= 3).length;

  return (
    <PageContainer>
      <PageHeader
        title="Buzón de facturas de proveedor"
        description="Documentos que operación recibió de los agentes y aún no se capturan en CxP."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Documentos por capturar" value={String(data.length)} icon={Inbox} />
        <KpiCard label="Con 3 días o más" value={String(masDeTresDias)} icon={XCircle} />
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay facturas pendientes de capturar. 🎉
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {data.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{row.nombre_archivo}</span>
                  <Badge variant="warning" size="sm">{diasEnEspera(row.created_at)} día(s)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Embarque{" "}
                  <Link className="underline underline-offset-2" to={`/embarques/${row.embarque_id}`}>
                    {row.embarques?.expediente ?? "sin expediente"}
                  </Link>
                  {" · "}Subida el {formatDate(row.created_at)}
                  {row.proveedores?.nombre ? ` · ${row.proveedores.nombre}` : ""}
                </p>
                {row.nota && <p className="text-xs text-muted-foreground">Nota: {row.nota}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void abrirArchivo(row)}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Ver archivo
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link to={`/embarques/${row.embarque_id}?tab=costos&focus=facturas-entrantes`}>Ir al embarque</Link>
                </Button>
                {canCapturarFacturaProveedor && (
                  <Button size="sm" variant="ghost" onClick={() => setARechazar(row)}>
                    <XCircle className="mr-2 h-4 w-4 text-destructive" /> Rechazar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RechazarFacturaEntranteDialog
        open={Boolean(aRechazar)}
        onOpenChange={(v) => { if (!v) setARechazar(null); }}
        pendiente={rechazar.isPending}
        onConfirm={async (motivo) => {
          if (!aRechazar) return;
          await rechazar.mutateAsync({ id: aRechazar.id, motivo });
          setARechazar(null);
        }}
      />
    </PageContainer>
  );
}
