/**
 * Fila del Buzón de facturas de proveedor (CxP Inbox).
 *
 * v13.365.0 — Fila compacta de una sola línea a 1366 px: barra de antigüedad,
 * proveedor como dato principal y acciones secundarias en el menú de tres puntos.
 * v13.398.0 — Rejilla de columnas fijas (antigüedad · datos · importe · acciones),
 * importe detectado visible, fecha de emisión y nombre de archivo relegado.
 */
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FacturaEntranteAcciones } from "@/features/bandejas/components/FacturaEntranteAcciones";
import {
  ImporteEntrante,
  MetaEntrante,
  ProveedorEntrante,
} from "@/features/bandejas/components/FacturaEntranteRow.parts";
import { cn } from "@/lib/utils";
import { chipsArchivosEntrante } from "@/lib/domain/facturasEntrantes";
import {
  antiguedadEntrante,
  entranteSinXml,
  type TonoAntiguedad,
} from "@/lib/domain/facturasEntrantesBuzon";
import type { FacturaEntranteRow as Fila } from "@/features/cxp/services/facturasEntrantes";

const BARRA_TONO: Record<TonoAntiguedad, string> = {
  neutral: "bg-muted",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const BADGE_TONO: Record<TonoAntiguedad, "neutral" | "info" | "warning" | "destructive"> = {
  neutral: "neutral",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

interface Props {
  row: Fila;
  puedeProcesar: boolean;
  /** Sólo lectura: pestañas de historial (capturadas / rechazadas). */
  soloLectura?: boolean;
  /** v13.368.0 — Factura viva que ya usa este CFDI; bloquea volver a capturarlo. */
  facturaExistenteId?: string | null;
  facturaExistenteFolio?: string | null;
  onVer: (row: Fila) => void;
  onVerXml: (row: Fila) => void;
  onCapturar: (row: Fila) => void;
  /** v13.366.0 — Captura la factura de proveedor con los datos del documento. */
  onCrearFactura: (row: Fila) => void;
  onRechazar: (row: Fila) => void;
}

export function FacturaEntranteRow({
  row,
  puedeProcesar,
  soloLectura = false,
  facturaExistenteId = null,
  facturaExistenteFolio = null,
  onVer,
  onVerXml,
  onCapturar,
  onCrearFactura,
  onRechazar,
}: Props) {
  const antiguedad = antiguedadEntrante(row);
  const chips = chipsArchivosEntrante(row);

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-y-0 left-0 w-1", BARRA_TONO[antiguedad.tono])} />
      {/* v13.398.1 — En móvil la fila se apila; en ≥768 px vuelve a una línea. */}
      <div className="flex flex-col gap-2 py-2.5 pl-4 pr-3 md:flex-row md:items-center md:gap-3">
        <div className="flex shrink-0 flex-row items-center gap-1 md:w-[92px] md:flex-col md:items-start">
          <Badge variant={BADGE_TONO[antiguedad.tono]} size="sm">{antiguedad.label}</Badge>
          <div className="flex gap-1">
            {chips.map((chip) => (
              <Badge key={chip} variant="outline" size="xs">{chip.toUpperCase()}</Badge>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => onVer(row)} className="min-w-0 flex-1 text-left">
          <ProveedorEntrante
            row={row}
            sinXml={entranteSinXml(row)}
            yaCapturado={!soloLectura && facturaExistenteId !== null}
            folioExistente={facturaExistenteFolio}
          />
          <MetaEntrante row={row} />
        </button>

        <ImporteEntrante row={row} />


        <FacturaEntranteAcciones
          row={row}
          editable={!soloLectura && puedeProcesar}
          facturaExistenteId={facturaExistenteId}
          onVer={onVer}
          onVerXml={onVerXml}
          onCapturar={onCapturar}
          onCrearFactura={onCrearFactura}
          onRechazar={onRechazar}
        />
      </div>
    </Card>
  );
}
