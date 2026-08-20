/**
 * Fila de la tabla de notas de crédito de proveedor.
 * Extraída de `NotasCreditoSection` (Power of 10: componentes ≤200 líneas).
 * UX-06/UX-08 — los botones de icono llevan `aria-label` y la cancelación
 * delega en el confirmador del contenedor.
 */
import { Check, X, ShieldCheck, FileText, FileDigit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/shared/ToneBadge";
import type { ChipTone } from "@/lib/ui/badgeTone";
import { formatCurrency, formatFechaDia } from "@/lib/formatters";
import { NcSatBadge } from "./NcSatBadge";
import { Hint } from "@/components/shared/Hint";
import type { NotaCreditoProveedor as NotaCredito } from "@/features/cxp/types";

import { TableCell, TableRow } from "@/components/ui/table";
const NC_TONES: Record<string, { tone: ChipTone; label: string }> = {
  Aplicada: { tone: "success", label: "Aplicada" },
  Aprobada: { tone: "info", label: "Aprobada" },
  Cancelada: { tone: "neutral", label: "Cancelada" },
  Borrador: { tone: "neutral", label: "Borrador" },
};

function NcEstadoBadge({ estado }: { estado: string }) {
  const meta = NC_TONES[estado] ?? { tone: "neutral" as ChipTone, label: estado };
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

interface Props {
  nota: NotaCredito;
  facturaId: string;
  canEdit: boolean;
  pendingAprobar: boolean;
  pendingAplicar: boolean;
  pendingCancelar: boolean;
  onAbrirArchivo: (path: string | null | undefined) => void;
  onAprobar: (id: string) => void;
  onAplicar: (id: string) => void;
  onCancelar: (nota: { id: string; folio: string }) => void;
}

export function NotaCreditoFila({
  nota: n,
  facturaId,
  canEdit,
  pendingAprobar,
  pendingAplicar,
  pendingCancelar,
  onAbrirArchivo,
  onAprobar,
  onAplicar,
  onCancelar,
}: Props) {
  const folio = n.folio_nc || "s/folio";
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="font-mono text-body-sm">{n.folio_nc}</TableCell>
      <TableCell>{formatFechaDia(n.fecha)}</TableCell>
      <TableCell className="text-muted-foreground">{n.motivo}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(Number(n.monto), n.moneda)}</TableCell>
      <TableCell className="text-center"><NcEstadoBadge estado={n.estado} /></TableCell>
      <TableCell className="text-center">
        <NcSatBadge
          facturaId={facturaId}
          ncId={n.id}
          uuidFiscal={n.uuid_fiscal}
          estatus={n.uuid_estatus_sat}
        />
      </TableCell>
      <TableCell className="text-center">
        {n.archivo_xml_url ? (
          <Hint label="Descargar XML">
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onAbrirArchivo(n.archivo_xml_url)}
              aria-label={`Descargar XML de la nota ${folio}`}
            >
              <FileDigit className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {n.archivo_pdf_url ? (
          <Hint label="Descargar PDF">
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onAbrirArchivo(n.archivo_pdf_url)}
              aria-label={`Descargar PDF de la nota ${folio}`}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </TableCell>
      <TableCell className="text-right space-x-1">
        {canEdit && n.estado === "Borrador" && (
          <Hint label="Aprobar">
            <Button
              size="sm" variant="ghost"
              className="h-7 text-info hover:bg-info/10"
              onClick={() => onAprobar(n.id)}
              disabled={pendingAprobar}
              aria-label={`Aprobar nota de crédito ${folio}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        )}
        {canEdit && n.estado === "Aprobada" && (
          <Hint label="Aplicar al saldo">
            <Button
              size="sm" variant="ghost"
              className="h-7 text-success hover:bg-success/10"
              onClick={() => onAplicar(n.id)}
              disabled={pendingAplicar}
              aria-label={`Aplicar al saldo la nota de crédito ${folio}`}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        )}
        {canEdit && n.estado !== "Cancelada" && (
          <Hint label="Cancelar">
            <Button
              size="sm" variant="ghost"
              className="h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onCancelar({ id: n.id, folio })}
              disabled={pendingCancelar}
              aria-label={`Cancelar nota de crédito ${folio}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        )}
      </TableCell>
    </TableRow>
  );
}
