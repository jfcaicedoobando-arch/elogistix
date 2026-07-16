import { useState, useMemo, useEffect } from "react";
import { Ban, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { listarSustitutas } from "@/features/facturacion/services/sustitutasDeFactura";
import { facturacion as facturacionKeys } from "@/features/facturacion/queryKeys";

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

// RFC genérico SAT para "público en general" y extranjeros.
const RFC_GENERICOS = new Set(["XAXX010101000", "XEXX010101000"]);

/**
 * Evalúa si la cancelación requiere aceptación del receptor según la
 * regla SAT 2.7.1.34 (RMF 2022+).
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
  facturaId, numero, fechaEmision, total, rfcCliente, open, onOpenChange, onAbrirSustituir,
}: Props) {
  const cancelar = useCancelarFactura();
  const [motivo, setMotivo] = useState<MotivoCancelacionSat>("02");
  const [sustitutaId, setSustitutaId] = useState<string>("");

  const cond = useMemo(
    () => evaluarCondicionesSAT({ fechaEmision, total, rfc: rfcCliente }),
    [fechaEmision, total, rfcCliente],
  );

  const sustitutasQ = useQuery({
    queryKey: facturacionKeys.sustitutasDe(facturaId),
    queryFn: () => listarSustitutas(facturaId as string),
    enabled: !!facturaId && open && motivo === "01",
    staleTime: 5_000,
  });

  const sustitutasTimbradas = useMemo(
    () => (sustitutasQ.data ?? []).filter((s) => s.estado === "Emitida" && !!s.uuid_fiscal),
    [sustitutasQ.data],
  );

  // Autoseleccionar la primera timbrada cuando llegan resultados.
  useEffect(() => {
    if (motivo !== "01") return;
    if (sustitutasTimbradas.length === 0) { setSustitutaId(""); return; }
    if (!sustitutasTimbradas.some((s) => s.id === sustitutaId)) {
      setSustitutaId(sustitutasTimbradas[0].id);
    }
  }, [motivo, sustitutasTimbradas, sustitutaId]);

  if (!facturaId) return null;

  const requiereSustituta = motivo === "01";
  const puedeConfirmar = !requiereSustituta || !!sustitutaId;

  const onConfirm = () => {
    cancelar.mutate(
      {
        facturaId,
        motivo,
        sustituidaPorFacturaId: requiereSustituta ? sustitutaId : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const abrirWizard = () => {
    onOpenChange(false);
    onAbrirSustituir?.();
  };

  const footer = (
    <>
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
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Ban}
      title={`Cancelar CFDI ${numero ?? ""}`}
      description="La cancelación se enviará al SAT a través de Facturapi. Selecciona el motivo correcto."
      size="lg"
      footer={footer}
    >
      {cond.mismoDia && (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Ventana de cancelación inmediata</AlertTitle>
          <AlertDescription className="text-foreground">
            Esta factura se emitió hoy. El SAT permite cancelarla sin aceptación del receptor.
          </AlertDescription>
        </Alert>
      )}

      {!cond.mismoDia && cond.requiereAceptacion && (
        <Alert className="border-warning/30 bg-warning/10">
          <Info className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">El receptor debe aceptar la cancelación</AlertTitle>
          <AlertDescription className="text-foreground space-y-1">
            <p>
              Por regla SAT 2.7.1.34, esta factura requiere que el cliente <strong>acepte la cancelación
              en su Buzón Tributario</strong>. Timbrar la sustituta (relación 04) no exenta este paso.
            </p>
            <p className="text-xs">Si no responde en 72 horas hábiles aplica cancelación por silencio positivo.</p>
          </AlertDescription>
        </Alert>
      )}

      {!cond.mismoDia && !cond.requiereAceptacion && (cond.montoBajo || cond.rfcGenerico) && (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Cancelación sin aceptación</AlertTitle>
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

      {requiereSustituta && (
        <div className="space-y-2">
          <Label>Factura sustituta timbrada</Label>
          {sustitutasQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Buscando sustitutas…</p>
          ) : sustitutasTimbradas.length === 0 ? (
            <Alert className="border-warning/30 bg-warning/10">
              <Info className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">No hay sustituta timbrada</AlertTitle>
              <AlertDescription className="text-foreground space-y-2">
                <p>
                  El motivo 01 requiere que primero timbres una factura sustituta con relación 04.
                  Usa el asistente de sustitución para crearla, editarla y timbrarla; después regresa a cancelar.
                </p>
                {onAbrirSustituir && (
                  <Button size="sm" variant="outline" onClick={abrirWizard}>
                    Abrir asistente de sustitución <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Select value={sustitutaId} onValueChange={setSustitutaId}>
                <SelectTrigger><SelectValue placeholder="Elige la sustituta" /></SelectTrigger>
                <SelectContent>
                  {sustitutasTimbradas.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.serie ?? ""}{s.folio_fiscal ? ` · Folio ${s.folio_fiscal}` : ""}
                      {s.numero ? ` — ${s.numero}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se enviará a FacturAPI el <code>facturapi_id</code> interno de la sustituta seleccionada
                (parámetro <code>substitution</code>). El UUID SAT queda en bitácora para auditoría.
              </p>
            </>
          )}
        </div>
      )}
    </FormDialogShell>
  );
}
