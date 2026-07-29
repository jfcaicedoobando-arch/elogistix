import { Ban, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { useCancelarFacturaController } from "@/features/facturacion/hooks/useCancelarFacturaController";
import { SelectorSustituta } from "@/features/facturacion/components/cancelacion/SelectorSustituta";
import { BannersCondicionesSAT } from "@/features/facturacion/components/cancelacion/BannersCondicionesSAT";
import { DialogConsultarFacturapi } from "@/features/facturacion/components/detalle/DialogConsultarFacturapi";

interface Props {
  facturaId: string | null;
  numero?: string;
  fechaEmision?: string | null;
  total?: number | null;
  rfcCliente?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAbrirSustituir?: () => void;
}

export function DialogCancelarFactura({
  facturaId, numero, fechaEmision, total, rfcCliente, open, onOpenChange, onAbrirSustituir,
}: Props) {
  const {
    cancelar,
    motivo,
    setMotivo,
    sustitutaId,
    setSustitutaId,
    consultarOpen,
    setConsultarOpen,
    cond,
    sustitutasQ,
    sustitutasTimbradas,
    requiereSustituta,
    puedeConfirmar,
    onConfirm,
    abrirWizard,
    errorMessage,
  } = useCancelarFacturaController({ facturaId, fechaEmision, total, rfcCliente, open, onOpenChange, onAbrirSustituir });

  if (!facturaId) return null;

  const footer = (
    <>
      {errorMessage && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConsultarOpen(true)}
          className="mr-auto"
        >
          <Search className="h-4 w-4 mr-1" /> Consultar en FacturAPI
        </Button>
      )}
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={cancelar.isPending || !puedeConfirmar}
      >
        {cancelar.isPending ? "Cancelando…" : "Confirmar cancelación"}
      </Button>
    </>
  );

  return (
    <>
      <FormDialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={Ban}
        title={`Cancelar CFDI ${numero ?? ""}`}
        description="La cancelación se enviará al SAT a través de Facturapi. Selecciona el motivo correcto."
        size="lg"
        footer={footer}
      >
        <BannersCondicionesSAT {...cond} />

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Motivo SAT</Label>
          <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoCancelacionSat)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS_CANCELACION_SAT.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {requiereSustituta && (
          <div className="space-y-2">
            <Label>Factura sustituta timbrada</Label>
            <SelectorSustituta
              isLoading={sustitutasQ.isLoading}
              sustitutasTimbradas={sustitutasTimbradas}
              value={sustitutaId}
              onChange={setSustitutaId}
              onAbrirSustituir={onAbrirSustituir ? abrirWizard : undefined}
            />
          </div>
        )}
      </FormDialogShell>

      <DialogConsultarFacturapi
        facturaId={facturaId}
        numero={numero ?? ""}
        open={consultarOpen}
        onOpenChange={setConsultarOpen}
      />
    </>
  );
}
