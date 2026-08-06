/** Wizard de factura manual (sin embarque/proforma). v13.315.2: rediseño UI. */
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { CreditoExcesoConfirmDialog } from "./CreditoExcesoConfirmDialog";
import { useFacturaManualForm } from "@/features/facturacion/hooks/useFacturaManualForm";
import { FacturaManualDatosFiscales } from "./FacturaManualDatosFiscales";
import { FaltantesHint } from "./FaltantesHint";
import { FacturaManualConceptosTable } from "./FacturaManualConceptosTable";
import { calcularTotalesConceptos } from "@/features/facturacion/utils/totalesConceptos";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogNuevaFacturaManual({ open, onOpenChange }: Props) {
  const {
    clientes, cliente, clienteIncompleto, onClienteChange,
    fiscal, updateFiscal, tasaIva,
    conceptos, setConceptos,
    notas, setNotas,
    creditoAlerta, setCreditoAlerta,
    puedeGuardar, puedeTimbrar, faltantesTimbrar,
    handleSubmit, onConfirmarExceso, isPending,
  } = useFacturaManualForm(open, () => onOpenChange(false));

  const totales = calcularTotalesConceptos(conceptos, tasaIva);

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {!puedeTimbrar && <FaltantesHint items={faltantesTimbrar} className="mr-auto" />}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
        <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={!puedeGuardar || isPending}>Guardar borrador</Button>
        <Button onClick={() => handleSubmit(true)} disabled={!puedeTimbrar || isPending}>{isPending ? "Procesando…" : "Crear y timbrar"}</Button>
      </div>
    </div>
  );

  return (
    <FormDialogShell
      open={open} onOpenChange={onOpenChange} icon={FilePlus2}
      title="Nueva factura manual"
      description="Para anticipos, servicios extra o cobros que no provienen de un embarque cerrado. Lo normal es facturar desde una proforma aprobada."
      size="3xl" footer={footer}
    >
      <div className="space-y-5">
        <FormDialogSection flat title="Información del cliente">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={cliente?.id ?? ""} onValueChange={onClienteChange}>
              <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} {c.rfc ? `· ${c.rfc}` : "· sin RFC"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clienteIncompleto && (
              <Alert variant="destructive">
                <AlertDescription>
                  Este cliente no tiene datos fiscales completos (RFC, CP y régimen).
                  Puedes guardar borrador, pero no podrás timbrar hasta completarlos en el detalle del cliente.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </FormDialogSection>

        <FormDialogSection flat title="Datos fiscales">
          <FacturaManualDatosFiscales
            value={fiscal} onChange={updateFiscal} diasReadonly={!!cliente}
            diasReadonlyReason={cliente ? "Los días de crédito se toman del perfil del cliente. Cámbialos en el detalle del cliente." : undefined}
          />
        </FormDialogSection>

        <FacturaManualConceptosTable
          conceptos={conceptos} moneda={fiscal.moneda} onChange={setConceptos}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <FormDialogSection flat title="Notas internas">
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              placeholder="Añadir notas u observaciones (opcional)…"
              className="resize-none"
            />
          </FormDialogSection>
          <div className="rounded-lg bg-primary text-primary-foreground p-6 shadow-md flex flex-col justify-center gap-3">
            <div className="flex justify-between text-sm opacity-80">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(totales.subtotal, fiscal.moneda)}</span>
            </div>
            <div className="flex justify-between text-sm opacity-80">
              <span>IVA ({Math.round(tasaIva * 100)}%)</span>
              <span className="tabular-nums">{formatCurrency(totales.iva, fiscal.moneda)}</span>
            </div>
            <div className="pt-3 border-t border-primary-foreground/20 flex justify-between items-baseline">
              <span className="text-base font-medium">Total</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatCurrency(totales.total, fiscal.moneda)}
                <span className="text-xs font-normal opacity-70 ml-1">{fiscal.moneda}</span>
              </span>
            </div>
          </div>
        </div>

        <CreditoExcesoConfirmDialog
          alerta={creditoAlerta} clienteNombre={cliente?.nombre}
          onOpenChange={(o) => { if (!o) setCreditoAlerta(null); }}
          onConfirm={onConfirmarExceso}
        />
      </div>
    </FormDialogShell>
  );
}
