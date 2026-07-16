import { useState, useMemo } from "react";
import { Ban, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";

interface Props {
  facturaId: string | null;
  numero?: string;
  fechaEmision?: string | null;
  total?: number | null;
  rfcCliente?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

// RFC genérico SAT para "público en general" y extranjeros.
const RFC_GENERICOS = new Set(["XAXX010101000", "XEXX010101000"]);

/**
 * Evalúa si la cancelación requiere aceptación del receptor según la
 * regla SAT 2.7.1.34 (RMF 2022+). Retorna las condiciones que se cumplen
 * (exentan) y las que no (requieren aceptación).
 */
function evaluarCondicionesSAT(params: {
  fechaEmision: string | null | undefined;
  total: number | null | undefined;
  rfc: string | null | undefined;
}): { mismoDia: boolean; montoBajo: boolean; rfcGenerico: boolean; requiereAceptacion: boolean } {
  const hoy = new Date().toISOString().slice(0, 10);
  const fecha = params.fechaEmision?.slice(0, 10) ?? null;
  const mismoDia = fecha !== null && fecha === hoy;
  const montoBajo = (params.total ?? Infinity) <= 1000;
  const rfc = (params.rfc ?? "").toUpperCase().trim();
  const rfcGenerico = RFC_GENERICOS.has(rfc);
  const requiereAceptacion = !(mismoDia || montoBajo || rfcGenerico);
  return { mismoDia, montoBajo, rfcGenerico, requiereAceptacion };
}

export function DialogCancelarFactura({
  facturaId, numero, fechaEmision, total, rfcCliente, open, onOpenChange,
}: Props) {
  const cancelar = useCancelarFactura();
  const [motivo, setMotivo] = useState<MotivoCancelacionSat>("02");
  const [sustituye, setSustituye] = useState("");

  const cond = useMemo(
    () => evaluarCondicionesSAT({ fechaEmision, total, rfc: rfcCliente }),
    [fechaEmision, total, rfcCliente],
  );

  if (!facturaId) return null;

  const onConfirm = () => {
    cancelar.mutate(
      { facturaId, motivo, sustituyeUuid: motivo === "01" ? sustituye : undefined },
      {
        onSuccess: () => onOpenChange(false),
        // En error transitorio (SAT caído) el hook ya muestra toast ámbar
        // con "Reintentar"; dejamos el modal abierto para no perder datos.
      },
    );
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={cancelar.isPending || (motivo === "01" && !sustituye)}
      >
        {cancelar.isPending ? "Cancelando…" : "Confirmar cancelación"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Ban}
      title={`Cancelar CFDI ${numero ?? ""}`}
      description="La cancelación se enviará al SAT a través de Facturapi. Selecciona el motivo correcto."
      size="lg"
      footer={footer}
    >
      {/* Banner condiciones SAT — regla 2.7.1.34 */}
      {cond.mismoDia && (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">
            Ventana de cancelación inmediata
          </AlertTitle>
          <AlertDescription className="text-foreground">
            Esta factura se emitió hoy. El SAT permite cancelarla sin aceptación del receptor.
            Aprovecha esta ventana antes del cierre del día.
          </AlertDescription>
        </Alert>
      )}

      {!cond.mismoDia && cond.requiereAceptacion && (
        <Alert className="border-warning/30 bg-warning/10">
          <Info className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            El receptor debe aceptar la cancelación
          </AlertTitle>
          <AlertDescription className="text-foreground space-y-1">
            <p>
              Por regla SAT 2.7.1.34, esta factura requiere que el cliente <strong>acepte la cancelación
              en su Buzón Tributario</strong>. Timbrar la sustituta (relación 04) no exenta este paso.
            </p>
            <p className="text-xs">
              Si no responde en 72 horas hábiles aplica cancelación por silencio positivo.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!cond.mismoDia && !cond.requiereAceptacion && (cond.montoBajo || cond.rfcGenerico) && (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">
            Cancelación sin aceptación
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {cond.montoBajo && "Monto ≤ $1,000 MXN: exenta de aceptación del receptor."}
            {cond.rfcGenerico && "RFC genérico: exenta de aceptación del receptor."}
          </AlertDescription>
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

      {motivo === "01" && (
        <div className="space-y-2">
          <Label>UUID que sustituye</Label>
          <Input
            value={sustituye}
            onChange={(e) => setSustituye(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
      )}
    </FormDialogShell>
  );
}
