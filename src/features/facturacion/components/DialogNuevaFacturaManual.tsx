/** Wizard de factura manual (sin embarque/proforma). FormDialogShell v13.120.0. */
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { CreditoExcesoConfirmDialog } from "./CreditoExcesoConfirmDialog";
import { useFacturaManualForm } from "@/features/facturacion/hooks/useFacturaManualForm";
import { FacturaManualDatosFiscales } from "./FacturaManualDatosFiscales";
import { FaltantesHint } from "./FaltantesHint";
import { FacturaManualConceptosTable } from "./FacturaManualConceptosTable";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogNuevaFacturaManual({ open, onOpenChange }: Props) {
  const {
    clientes, cliente, clienteIncompleto, onClienteChange,
    fiscal, updateFiscal,
    conceptos, setConceptos,
    notas, setNotas,
    creditoAlerta, setCreditoAlerta,
    puedeGuardar, puedeTimbrar, faltantesTimbrar,
    handleSubmit, onConfirmarExceso, isPending,
  } = useFacturaManualForm(open);

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
      size="xl" footer={footer}
    >
      <div>
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
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              Este cliente no tiene datos fiscales completos (RFC, CP y régimen).
              Puedes guardar borrador, pero no podrás timbrar hasta completarlos en el detalle del cliente.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <FacturaManualDatosFiscales
        value={fiscal} onChange={updateFiscal} diasReadonly={!!cliente}
        diasReadonlyReason={cliente ? "Los días de crédito se toman del perfil del cliente. Cámbialos en el detalle del cliente." : undefined}
      />

      <FacturaManualConceptosTable
        conceptos={conceptos} moneda={fiscal.moneda} tasaIva={fiscal.tasaIva} onChange={setConceptos}
      />

      <div>
        <Label>Notas (opcional)</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </div>

      <CreditoExcesoConfirmDialog
        alerta={creditoAlerta} clienteNombre={cliente?.nombre}
        onOpenChange={(o) => { if (!o) setCreditoAlerta(null); }}
        onConfirm={onConfirmarExceso}
      />
    </FormDialogShell>
  );
}
