/**
 * Diálogo "Marcar como capturada" del buzón CxP.
 *
 * Contabilidad elige la factura de proveedor (del mismo embarque) que ya
 * capturó a partir del documento; el RPC `capturar_factura_entrante` cierra
 * el documento y hereda el PDF a la factura.
 */
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { useFacturasVinculablesEntrante } from "@/features/cxp/hooks/useFacturasVinculablesEntrante";
import { etiquetaFacturaVinculable } from "@/features/cxp/services/facturasVinculablesEntrante";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string | null;
  expediente?: string | null;
  nombreArchivo?: string | null;
  pendiente: boolean;
  onConfirm: (facturaId: string) => Promise<void> | void;
}

export function MarcarCapturadaDialog({
  open, onOpenChange, embarqueId, expediente, nombreArchivo, pendiente, onConfirm,
}: Props) {
  const [facturaId, setFacturaId] = useState("");
  const { data: candidatas = [], isLoading } = useFacturasVinculablesEntrante(embarqueId, open);

  useEffect(() => { if (!open) setFacturaId(""); }, [open]);

  const sinCandidatas = !isLoading && candidatas.length === 0;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={CheckCircle2}
      title="Marcar documento como capturado"
      description={
        nombreArchivo
          ? `Vincula “${nombreArchivo}” con la factura de proveedor que capturaste.`
          : "Vincula el documento con la factura de proveedor que capturaste."
      }
      size="md"
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || !facturaId}
            onClick={async () => { await onConfirm(facturaId); }}
          >
            {pendiente ? "Guardando…" : "Marcar como capturada"}
          </Button>
        </>
      )}
    >
      <FormDialogSection title="Factura de proveedor" cols={1}>
        {isLoading && <Skeleton className="h-10 w-full" />}

        {sinCandidatas && (
          <Alert>
            <AlertDescription className="text-sm">
              El embarque {expediente ?? ""} todavía no tiene facturas de proveedor capturadas.
              Captúrala primero en el tab <strong>Costos</strong> del embarque y regresa aquí.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && candidatas.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="factura-vinculable">Selecciona la factura capturada</Label>
            <Select value={facturaId} onValueChange={setFacturaId}>
              <SelectTrigger id="factura-vinculable">
                <SelectValue placeholder="Elige una factura del embarque" />
              </SelectTrigger>
              <SelectContent>
                {candidatas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="truncate">
                      {etiquetaFacturaVinculable(f)} · {formatCurrency(f.total, f.moneda)}
                      {f.fecha_emision ? ` · ${formatDate(f.fecha_emision)}` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sólo se listan facturas vivas de este embarque; las canceladas quedan fuera.
            </p>
          </div>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
