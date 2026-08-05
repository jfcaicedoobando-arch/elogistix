import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
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


export function EliminarFacturaCxpDialog({ factura, onOpenChange, isPending, onConfirm }: Props) {
  const [paso2, setPaso2] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!factura) {
      setPaso2(false);
      setConfirmText("");
    }
  }, [factura]);

  const close = () => {
    setPaso2(false);
    setConfirmText("");
    onOpenChange(false);
  };

  const canDelete = confirmText.trim().toUpperCase() === "ELIMINAR";
  
  const estatusMeta = factura ? ESTATUS_META[factura.estatus as EstatusCxP] : null;

  return (
    <AlertDialog open={!!factura} onOpenChange={(v) => { if (!v) close(); }}>
      <AlertDialogContent className={cn(dialogSize.lg, "p-0 gap-0 overflow-hidden")}>
        {factura && (
          <>
            {/* Header */}
            <div className="p-6 pb-4">
              <h2 className="text-xl font-bold text-foreground leading-tight tracking-tight">
                {paso2 ? "Confirmar eliminación" : `¿Eliminar la factura ${factura.folio_proveedor}?`}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="px-2 py-0.5 bg-muted text-muted-foreground text-label font-bold tracking-wider rounded border border-border font-mono">
                  {factura.folio_interno}
                </span>
                <span className="text-sm text-muted-foreground">
                  Folio prov. <span className="font-medium text-foreground font-mono">{factura.folio_proveedor}</span>
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-sm font-medium text-foreground uppercase tracking-tight truncate max-w-[220px]">
                  {factura.proveedor_nombre}
                </span>
              </div>
            </div>

            {/* Status Line */}
            {estatusMeta && (
              <div className="px-6 py-2 bg-muted/40 border-y border-border flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", TONE_DOT[estatusMeta.tone])} />
                <span className={cn("text-label font-bold tracking-wide uppercase", TONE_TEXT[estatusMeta.tone])}>
                  {estatusMeta.label}
                </span>
              </div>
            )}


            {/* Body */}
            <div className="p-6 space-y-4">
              <EliminarFacturaFinancialGrid factura={factura} />


              {/* Paso 1: nota de papelera. Paso 2: input ELIMINAR */}
              {!paso2 ? (
                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg flex gap-3">
                  <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">
                    La factura será enviada a la papelera. Podrás restaurarla desde el historial si fue un error.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <Label htmlFor="confirm-delete" className="text-sm text-foreground">
                    Escribe <span className="font-bold text-destructive font-mono">ELIMINAR</span> para confirmar:
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && canDelete && !isPending) {
                        e.preventDefault();
                        await onConfirm();
                        close();
                      }
                    }}
                    placeholder="ELIMINAR"
                    autoComplete="off"
                    className="font-mono"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-muted/40 border-t border-border flex justify-end items-center gap-2">
              <Button variant="ghost" onClick={close} disabled={isPending}>
                Cancelar
              </Button>
              {!paso2 ? (
                <Button
                  variant="destructive"
                  onClick={() => setPaso2(true)}
                >
                  Continuar
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  disabled={isPending || !canDelete}
                  onClick={async () => {
                    await onConfirm();
                    close();
                  }}
                >
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
                  ) : (
                    "Eliminar factura"
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
