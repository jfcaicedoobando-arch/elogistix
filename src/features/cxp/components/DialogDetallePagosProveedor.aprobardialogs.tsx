/**
 * Diálogos de aprobar/rechazar factura, extraídos del StatusActionBar
 * para mantener el archivo bajo 200 líneas (Power of 10).
 */
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import {
  MOTIVO_RECHAZO_MIN,
  MOTIVO_RECHAZO_MAX,
  JUSTIFICACION_SIN_VINCULO_MIN,
} from "@/features/cxp/services/aprobacionFactura";
import type { useAprobarFactura } from "@/features/cxp/hooks/useAprobarFactura";
import type { FacturaCxP } from "@/features/cxp/services";

export function AprobarRechazarDialogs({
  f, openAprobar, openRechazar, setOpenAprobar, setOpenRechazar, aprobar, ctxLabel,
}: {
  f: FacturaCxP;
  openAprobar: boolean;
  openRechazar: boolean;
  setOpenAprobar: (v: boolean) => void;
  setOpenRechazar: (v: boolean) => void;
  aprobar: ReturnType<typeof useAprobarFactura>;
  ctxLabel: string;
}) {
  // Ola 4 (H2): sin embarque vinculado no hay contra qué contrastar el gasto;
  // la base de datos exige una justificación escrita para aprobar.
  const requiereJustificacion = !f.embarque_id;

  const confirmarAprobacion = async (motivo?: string) => {
    try {
      await aprobar.mutateAsync({
        id: f.id, aprobar: true, motivo,
        folio: f.folio_interno, proveedor: f.proveedor_nombre,
      });
      setOpenAprobar(false);
    } catch { /* toast del hook */ }
  };

  return (
    <>
      {requiereJustificacion ? (
        <ReasonDialog
          open={openAprobar} onOpenChange={setOpenAprobar} icon={CheckCircle2}
          title="Aprobar factura sin embarque"
          description={[
            ctxLabel ? `${ctxLabel} — ` : "",
            "Esta factura no está ligada a un embarque ni a costos acordados. ",
            "Escribe para qué fue el gasto: la justificación queda guardada en la factura y en la bitácora. ",
            "Si el monto supera el límite autorizado, tendrás que vincularla al embarque.",
          ].join("")}
          label="Justificación del gasto"
          placeholder="Ej. Renta de oficina de agosto según contrato vigente"
          confirmLabel="Aprobar factura"
          minLength={JUSTIFICACION_SIN_VINCULO_MIN}
          pending={aprobar.isPending}
          onConfirm={(motivo) => confirmarAprobacion(motivo)}
        />
      ) : (
        <ConfirmActionDialog
          open={openAprobar} onOpenChange={setOpenAprobar}
          title="Aprobar factura"
          titleIcon={<CheckCircle2 className="h-5 w-5 text-success" aria-hidden />}
          confirmLabel={aprobar.isPending ? "Aprobando…" : "Sí, aprobar"}
          isPending={aprobar.isPending}
          onConfirm={() => confirmarAprobacion()}
          description={<>
            {ctxLabel ? <><b>{ctxLabel}</b><br /></> : null}
            Al aprobar, la factura pasará a estado <b>Vigente</b> y quedará lista para programar pago.
            Esta acción se registrará en la bitácora.
          </>}
        />
      )}

      <ReasonDialog
        open={openRechazar} onOpenChange={setOpenRechazar} icon={XCircle}
        title="Rechazar factura"
        description={[
          ctxLabel ? `${ctxLabel} — ` : "",
          "Al rechazar: la factura se cancela, suelta el embarque y sus costos vuelven a quedar ",
          "pendientes de factura. El archivo del proveedor queda marcado como rechazado. ",
          "Indica el motivo (se registra en la bitácora).",
        ].join("")}

        label="Motivo"
        placeholder={`Ej. Folio incorrecto, falta XML, monto no coincide... (máx. ${MOTIVO_RECHAZO_MAX} caracteres)`}
        confirmLabel="Rechazar factura"
        minLength={MOTIVO_RECHAZO_MIN}
        pending={aprobar.isPending}
        onConfirm={async (motivo) => {
          try {
            await aprobar.mutateAsync({ id: f.id, aprobar: false, motivo, folio: f.folio_interno, proveedor: f.proveedor_nombre });
            setOpenRechazar(false);
          } catch { /* toast del hook */ }
        }}
      />
    </>
  );
}
