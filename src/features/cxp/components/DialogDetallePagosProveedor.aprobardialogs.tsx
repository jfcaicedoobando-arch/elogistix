/**
 * Diálogos de aprobar/rechazar factura, extraídos del StatusActionBar
 * para mantener el archivo bajo 200 líneas (Power of 10).
 */
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { MOTIVO_RECHAZO_MIN, MOTIVO_RECHAZO_MAX } from "@/features/cxp/services/aprobacionFactura";
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
  return (
    <>
      <ConfirmActionDialog
        open={openAprobar} onOpenChange={setOpenAprobar}
        title="Aprobar factura"
        titleIcon={<CheckCircle2 className="h-5 w-5 text-success" aria-hidden />}
        confirmLabel={aprobar.isPending ? "Aprobando…" : "Sí, aprobar"}
        isPending={aprobar.isPending}
        onConfirm={async () => {
          try {
            await aprobar.mutateAsync({ id: f.id, aprobar: true, folio: f.folio_interno, proveedor: f.proveedor_nombre });
            setOpenAprobar(false);
          } catch { /* toast del hook */ }
        }}
        description={<>
          {ctxLabel ? <><b>{ctxLabel}</b><br /></> : null}
          Al aprobar, la factura pasará a estado <b>Vigente</b> y quedará lista para programar pago.
          Esta acción se registrará en la bitácora.
        </>}
      />
      <ReasonDialog
        open={openRechazar} onOpenChange={setOpenRechazar} icon={XCircle}
        title="Rechazar factura"
        description={ctxLabel
          ? `${ctxLabel} — Indica el motivo del rechazo. Será registrado en la bitácora y notificado al proveedor.`
          : "Indica el motivo del rechazo."}
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
