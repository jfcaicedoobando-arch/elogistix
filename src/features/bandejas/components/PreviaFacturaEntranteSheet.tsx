/**
 * Vista previa lateral de un documento del buzón CxP.
 *
 * v13.365.0 — Muestra el PDF embebido (URL `blob:`, inmune a bloqueos de
 * extensiones) junto con los datos y las acciones del documento.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  urlPreviaFacturaEntrante,
  type FacturaEntranteRow,
} from "@/features/cxp/services/facturasEntrantes";
import {
  PreviaAcciones,
  PreviaBadges,
  PreviaDatos,
  PreviaVisor,
} from "@/features/bandejas/components/PreviaFacturaEntranteSheet.parts";
import { esRutaPdf } from "@/lib/pdf/blobPdfUrl";

interface Props {
  row: FacturaEntranteRow | null;
  onOpenChange: (open: boolean) => void;
  puedeProcesar: boolean;
  onVerXml: (row: FacturaEntranteRow) => void;
  onCapturar: (row: FacturaEntranteRow) => void;
  onCrearFactura: (row: FacturaEntranteRow) => void;
  onRechazar: (row: FacturaEntranteRow) => void;
}

/** Descarga el archivo como `blob:` y libera la URL al cerrar o cambiar de fila. */
function useUrlPrevia(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let objectUrl: string | null = null;
    let cancelado = false;
    setUrl(null);
    setError(false);
    void urlPreviaFacturaEntrante(path)
      .then((generada) => {
        objectUrl = generada;
        if (cancelado) URL.revokeObjectURL(generada);
        else setUrl(generada);
      })
      .catch(() => { if (!cancelado) setError(true); });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return { url, error };
}

export function PreviaFacturaEntranteSheet({
  row,
  onOpenChange,
  puedeProcesar,
  onVerXml,
  onCapturar,
  onCrearFactura,
  onRechazar,
}: Props) {
  const { url, error } = useUrlPrevia(row?.archivo_path ?? null);
  const esPdf = esRutaPdf(row?.archivo_path);
  const procesable = Boolean(row && row.estado === "por_capturar" && puedeProcesar);

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
            <PreviaBadges row={row} />
            <PreviaDatos row={row} />
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
              <PreviaVisor
                url={url}
                error={error}
                esPdf={esPdf}
                nombreArchivo={row.nombre_archivo}
              />
            </div>
            <PreviaAcciones
              row={row}
              procesable={procesable}
              onVerXml={onVerXml}
              onCapturar={onCapturar}
              onCrearFactura={onCrearFactura}
              onRechazar={onRechazar}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
