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
import type { NotaCreditoProveedor as NotaCredito } from "@/features/cxp/types";

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
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-mono text-body-sm">{n.folio_nc}</td>
      <td className="px-3 py-2">{formatFechaDia(n.fecha)}</td>
      <td className="px-3 py-2 text-muted-foreground">{n.motivo}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(n.monto), n.moneda)}</td>
      <td className="px-3 py-2 text-center"><NcEstadoBadge estado={n.estado} /></td>
      <td className="px-3 py-2 text-center">
        <NcSatBadge
          facturaId={facturaId}
          ncId={n.id}
          uuidFiscal={n.uuid_fiscal}
          estatus={n.uuid_estatus_sat}
        />
      </td>
      <td className="px-3 py-2 text-center">
        {n.archivo_xml_url ? (
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onAbrirArchivo(n.archivo_xml_url)}
            title="Descargar XML"
            aria-label={`Descargar XML de la nota ${folio}`}
          >
            <FileDigit className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {n.archivo_pdf_url ? (
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onAbrirArchivo(n.archivo_pdf_url)}
            title="Descargar PDF"
            aria-label={`Descargar PDF de la nota ${folio}`}
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-right space-x-1">
        {canEdit && n.estado === "Borrador" && (
          <Button
            size="sm" variant="ghost"
            className="h-7 text-info hover:bg-info/10"
            onClick={() => onAprobar(n.id)}
            disabled={pendingAprobar}
            title="Aprobar"
            aria-label={`Aprobar nota de crédito ${folio}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
        )}
        {canEdit && n.estado === "Aprobada" && (
          <Button
            size="sm" variant="ghost"
            className="h-7 text-success hover:bg-success/10"
            onClick={() => onAplicar(n.id)}
            disabled={pendingAplicar}
            title="Aplicar al saldo"
            aria-label={`Aplicar al saldo la nota de crédito ${folio}`}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        {canEdit && n.estado !== "Cancelada" && (
          <Button
            size="sm" variant="ghost"
            className="h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onCancelar({ id: n.id, folio })}
            disabled={pendingCancelar}
            title="Cancelar"
            aria-label={`Cancelar nota de crédito ${folio}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}
