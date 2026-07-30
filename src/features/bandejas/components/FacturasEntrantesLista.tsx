/**
 * Lista de documentos del buzón CxP: skeletons, estado vacío y filas.
 * v13.365.0
 */
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FacturaEntranteRow } from "@/features/bandejas/components/FacturaEntranteRow";
import { useCfdisYaCapturados } from "@/features/bandejas/hooks/useCfdisYaCapturados";
import type { FacturaEntranteRow as Fila } from "@/features/cxp/services/facturasEntrantes";

export interface AccionesEntrante {
  onVer: (row: Fila) => void;
  onVerXml: (row: Fila) => void;
  onCapturar: (row: Fila) => void;
  onCrearFactura: (row: Fila) => void;
  onRechazar: (row: Fila) => void;
}

interface Props extends AccionesEntrante {
  rows: Fila[];
  isLoading: boolean;
  puedeProcesar: boolean;
  soloLectura?: boolean;
  tituloVacio: string;
  textoVacio: string;
}

export function FacturasEntrantesLista({
  rows,
  isLoading,
  puedeProcesar,
  soloLectura = false,
  tituloVacio,
  textoVacio,
  ...acciones
}: Props) {
  // v13.368.0 — Sólo interesa en la bandeja activa: marcar CFDI ya capturados.
  const facturaDeCfdi = useCfdisYaCapturados(soloLectura ? [] : rows);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">{tituloVacio}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{textoVacio}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const existente = facturaDeCfdi(row.uuid_fiscal);
        return (
          <FacturaEntranteRow
            key={row.id}
            row={row}
            puedeProcesar={puedeProcesar}
            soloLectura={soloLectura}
            facturaExistenteId={existente?.id ?? null}
            facturaExistenteFolio={existente?.folio_interno ?? null}
            {...acciones}
          />
        );
      })}
    </div>
  );
}
