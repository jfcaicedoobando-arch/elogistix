/**
 * Vista previa lateral de un documento del buzón CxP.
 *
 * v13.365.0 — Muestra el PDF embebido (URL `blob:`, inmune a bloqueos de
 * extensiones) junto con los datos y las acciones del documento.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileCode2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/formatters/dates";
import { antiguedadEntrante, entranteSinXml } from "@/lib/domain/facturasEntrantesBuzon";
import { etiquetaEstadoEntrante, varianteEstadoEntrante } from "@/lib/domain/facturasEntrantes";
import {
  urlPreviaFacturaEntrante,
  type FacturaEntranteRow,
} from "@/features/cxp/services/facturasEntrantes";

interface Props {
  row: FacturaEntranteRow | null;
  onOpenChange: (open: boolean) => void;
  puedeProcesar: boolean;
  onVerXml: (row: FacturaEntranteRow) => void;
  onCapturar: (row: FacturaEntranteRow) => void;
  onRechazar: (row: FacturaEntranteRow) => void;
}

function DatoLinea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{valor}</span>
    </div>
  );
}

export function PreviaFacturaEntranteSheet({
  row,
  onOpenChange,
  puedeProcesar,
  onVerXml,
  onCapturar,
  onRechazar,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!row) return;
    let objectUrl: string | null = null;
    let cancelado = false;
    setUrl(null);
    setError(false);
    void urlPreviaFacturaEntrante(row.archivo_path)
      .then((generada) => {
        objectUrl = generada;
        if (cancelado) {
          URL.revokeObjectURL(generada);
          return;
        }
        setUrl(generada);
      })
      .catch(() => { if (!cancelado) setError(true); });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row]);

  const esPdf = !row?.archivo_path.toLowerCase().endsWith(".xml");
  const pendiente = row ? row.estado === "por_capturar" : false;

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="truncate pr-6">
            {row?.proveedores?.nombre ?? "Documento del buzón"}
          </SheetTitle>
        </SheetHeader>

        {row && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={varianteEstadoEntrante(row.estado)} size="sm">
                {etiquetaEstadoEntrante(row.estado)}
              </Badge>
              <Badge variant="outline" size="sm">{antiguedadEntrante(row).label}</Badge>
              {entranteSinXml(row) && <Badge variant="warning" size="sm">Falta XML</Badge>}
            </div>

            <div className="space-y-1.5 rounded-md border p-3">
              <DatoLinea etiqueta="Expediente" valor={row.embarques?.expediente ?? "—"} />
              <DatoLinea etiqueta="Folio" valor={row.folio_serie ?? "—"} />
              <DatoLinea etiqueta="Archivo" valor={row.nombre_archivo} />
              <DatoLinea etiqueta="Subido el" valor={formatDate(row.created_at)} />
              {row.nota && <DatoLinea etiqueta="Nota" valor={row.nota} />}
              {row.rechazo_motivo && (
                <DatoLinea etiqueta="Motivo de rechazo" valor={row.rechazo_motivo} />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
              {error && (
                <p className="p-4 text-sm text-muted-foreground">
                  No se pudo cargar la vista previa. Descarga el archivo desde el menú de acciones.
                </p>
              )}
              {!error && !url && <Skeleton className="h-full w-full" />}
              {!error && url && esPdf && (
                <iframe src={url} title="Vista previa de la factura" className="h-full w-full" />
              )}
              {!error && url && !esPdf && (
                <p className="p-4 text-sm text-muted-foreground">
                  Este documento es un XML: descárgalo para revisarlo.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {row.xml_path && (
                <Button size="sm" variant="outline" onClick={() => onVerXml(row)}>
                  <FileCode2 className="mr-2 h-4 w-4" /> Descargar XML
                </Button>
              )}
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/embarques/${row.embarque_id}?tab=costos&focus=facturas-entrantes`}>
                  Ir al embarque
                </Link>
              </Button>
              {pendiente && puedeProcesar && (
                <>
                  <Button size="sm" onClick={() => onCapturar(row)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como capturada
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onRechazar(row)}>
                    <XCircle className="mr-2 h-4 w-4 text-destructive" /> Rechazar
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
