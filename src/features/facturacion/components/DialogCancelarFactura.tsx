import { useState, useMemo, useEffect } from "react";
import { Ban, AlertCircle, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { listarSustitutas } from "@/features/facturacion/services/sustitutasDeFactura";
import { facturacion as facturacionKeys } from "@/features/facturacion/queryKeys";
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

  const [consultarOpen, setConsultarOpen] = useState(false);

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

  const errorMessage = cancelar.isError
    ? (cancelar.error instanceof Error ? cancelar.error.message : String(cancelar.error))
    : null;

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
