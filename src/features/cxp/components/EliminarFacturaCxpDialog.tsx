import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { cn } from "@/lib/utils";
import type { FacturaCxP } from "@/features/cxp/services";
import type { EstatusCxP } from "@/features/cxp/services/proveedorFacturas";
import { TONE_DOT, TONE_TEXT, type ChipTone } from "@/lib/ui/badgeTone";
import { EliminarFacturaFinancialGrid } from "./EliminarFacturaFinancialGrid";

const ESTATUS_META: Record<EstatusCxP, { label: string; tone: ChipTone }> = {
  Cancelada:    { label: "Cancelada",         tone: "neutral" },
  Rechazada:    { label: "Rechazada",         tone: "destructive" },
  Borrador:     { label: "Borrador",          tone: "neutral" },
  "Por aprobar":{ label: "Por aprobar",       tone: "warning" },
  Pagada:       { label: "Pagada",            tone: "success" },
  Vencida:      { label: "Vencida",           tone: "destructive" },
  "Por vencer": { label: "Por vencer",        tone: "warning" },
  Parcial:      { label: "Parcial",           tone: "info" },
  Vigente:      { label: "Pendiente de pago", tone: "warning" },
};

interface Props {
  factura: FacturaCxP | null;
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Ola 3 · O3.1 — migrado a `DoubleConfirmDeleteDialog` (patrón canónico de
 * borrado con doble confirmación "ELIMINAR"). El resumen financiero viaja en
 * el slot `children` del paso 1; ya no hay `h2` crudo ni AlertDialog a medida.
 */
export function EliminarFacturaCxpDialog({ factura, onOpenChange, isPending, onConfirm }: Props) {
  const estatusMeta = factura ? ESTATUS_META[factura.estatus as EstatusCxP] : null;

  return (
    <DoubleConfirmDeleteDialog
      open={!!factura}
      onOpenChange={(v) => { if (!v) onOpenChange(false); }}
      entityName={factura ? `la factura ${factura.folio_proveedor}` : "la factura"}
      description={
        <>
          La factura será enviada a la papelera. Podrás restaurarla desde el historial si fue un error.
        </>
      }
      finalDescription="Esta acción la envía a la papelera y puede restaurarse después."
      onConfirm={onConfirm}
      isPending={isPending}
    >
      {factura && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-label font-bold tracking-wider rounded border border-border font-mono">
              {factura.folio_interno}
            </span>
            <span className="text-body text-muted-foreground">
              Folio prov. <span className="font-medium text-foreground font-mono">{factura.folio_proveedor}</span>
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-body font-medium text-foreground truncate max-w-[220px]">
              {factura.proveedor_nombre}
            </span>
          </div>
          {estatusMeta && (
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", TONE_DOT[estatusMeta.tone])} />
              <span className={cn("text-label font-bold tracking-wide uppercase", TONE_TEXT[estatusMeta.tone])}>
                {estatusMeta.label}
              </span>
            </div>
          )}
          <EliminarFacturaFinancialGrid factura={factura} />
        </div>
      )}
    </DoubleConfirmDeleteDialog>
  );
}
